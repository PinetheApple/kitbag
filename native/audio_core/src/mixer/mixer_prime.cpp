#include <algorithm>
#include <chrono>
#include <memory>
#include <thread>
#include <vector>

#include "mixer/mixer.h"

namespace kitbag {
namespace {

constexpr auto kVerdictTimeout = std::chrono::milliseconds(500);
constexpr auto kVerdictPoll = std::chrono::microseconds(500);

}  // namespace

// Moving in bypass: hand over ahead of the head, so playback never stops for
// the prime. Engaged or still: a primed jump at the audible head.
void Mixer::PrimeNow(uint64_t now_frame, bool engine_running) {
  bool used[kKeyBusCount] = {};
  if (!app_engaged_ || MarkUsedBuses(used) == 0) return;
  if (app_playing_ && !engaged_.load(std::memory_order_relaxed)) {
    HandOver(now_frame, engine_running);
    return;
  }
  const TransportPlan plan{.frame = HeadToPrime(), .layout = app_layout_};
  PrimedRelayout(plan, now_frame, engine_running);
}

int64_t Mixer::HeadToPrime() const {
  const Head head = PlannedHead();
  if (!head.jump_pending && engaged_.load(std::memory_order_relaxed)) {
    return SeekTarget(static_cast<int64_t>(position()));
  }
  return SeekTarget(app_layout_.SongFrameAt(head.stream));
}

// The staged sources give up the pre-roll, so they are committed at
// frame + lag, where the callback carries on feeding.
bool Mixer::PrimedRelayout(
    TransportPlan plan,
    uint64_t now_frame,
    bool engine_running
) {
  plan.epoch = app_epoch_ + 1;
  const SourceStamp stamp{
      .epoch = plan.epoch,
      .layout = plan.layout,
      .align = true
  };
  if (!StageAll(plan.frame, stamp, true)) return false;
  Bank bank;
  BuildBank(plan.frame, true, &bank);
  PublishBank(&bank, &plan, now_frame, engine_running);
  CommitPlan(plan, now_frame, engine_running);
  AdoptBank(plan, now_frame, engine_running);
  return true;
}

bool Mixer::BuildBank(int64_t frame, bool staged, Bank* bank) {
  bool used[kKeyBusCount] = {};
  const int in_use = MarkUsedBuses(used);
  MatchBusConfig(in_use, true);
  bank->generation = ++next_bus_generation_;
  const TimeStretch* any = nullptr;
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (!used[s]) continue;
    bank->slots[s] = MakeBus(s, bank->generation);
    any = &bank->slots[s]->bus->stretch;
  }
  if (any == nullptr) return false;
  bank->lag = std::min(any->SongLagFrames(app_rate_), any->SeekFrames());
  if (!ReadBankPreRoll(frame, staged, bank)) return false;
  for (auto& slot : bank->slots) {
    if (slot == nullptr) continue;
    KeyBus& bus = *slot->bus;
    bus.dormant = false;
    bus.stretch.OutputSeek(bus.preroll.data(), static_cast<int>(bank->lag));
  }
  return true;
}

// Every loaded stem is read, muted or not, so all of them end at frame + lag.
bool Mixer::ReadBankPreRoll(int64_t frame, bool staged, Bank* bank) {
  const auto lag = static_cast<uint32_t>(bank->lag);
  std::vector<float> pcm(
      static_cast<size_t>(lag) * StreamingTrack::kMaxChannels
  );
  const bool any_solo = any_solo_.load(std::memory_order_relaxed);
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    StreamingTrack& stream = *tracks_[t].stream;
    if (!stream.ready()) continue;
    const auto start = static_cast<uint64_t>(std::max<int64_t>(frame, 0));
    const PreRead got =
        staged ? stream.ReadStaged(pcm.data(), lag)
               : stream.ReadAhead(start, app_layout_, pcm.data(), lag);
    if (got.channels == 0) {
      if (staged) continue;
      return false;
    }
    KeyBus& bus = *bank->slots[app_pitch_[t] - kMinPitchSemitones]->bus;
    StreamingTrack::AddToOutput(
        pcm.data(),
        got.channels,
        got.frames,
        bus.preroll.data(),
        TrackGain(tracks_[t], any_solo)
    );
  }
  return true;
}

// Into the bank the callback is not playing, so nothing it holds is replaced.
void Mixer::PublishBank(
    Bank* bank,
    TransportPlan* plan,
    uint64_t now_frame,
    bool engine_running
) {
  const int target = 1 - app_bank_;
  for (int s = 0; s < kKeyBusCount; ++s) {
    buses_[target][s]
        .Publish(std::move(bank->slots[s]), now_frame, engine_running);
  }
  plan->primed = true;
  plan->bank = target;
  plan->generation = bank->generation;
  plan->rate = app_rate_;
  plan->lag = bank->lag;
}

void Mixer::AdoptBank(
    const TransportPlan& plan,
    uint64_t now_frame,
    bool engine_running
) {
  FreeBank(app_bank_, now_frame, engine_running);
  app_bank_ = plan.bank;
  app_bus_generation_ = plan.generation;
  app_primed_ = true;
}

void Mixer::FreeBank(int bank, uint64_t now_frame, bool engine_running) {
  for (auto& slot : buses_[bank]) {
    if (slot.Get() != nullptr) slot.Publish(nullptr, now_frame, engine_running);
  }
}

// A missed switch point is never adopted late: the next attempt picks a new
// one further ahead, and the last resort is a primed jump.
void Mixer::HandOver(uint64_t now_frame, bool engine_running) {
  for (int attempt = 0; attempt < kHandOverAttempts; ++attempt) {
    const int64_t lead = attempt == 0 && first_lead_frames_ != 0
                             ? first_lead_frames_
                             : handover_lead_frames_ << attempt;
    first_lead_frames_ = 0;
    if (TryHandOver(lead, now_frame, engine_running)) return;
  }
  const TransportPlan plan{.frame = HeadToPrime(), .layout = app_layout_};
  PrimedRelayout(plan, now_frame, engine_running);
}

// False only when the callback reports it had already passed the frame.
bool Mixer::TryHandOver(int64_t lead, uint64_t now_frame, bool engine_running) {
  const Head head = PlannedHead();
  Bank bank;
  if (head.jump_pending || engaged_.load(std::memory_order_relaxed) ||
      !BuildBank(head.stream + lead, false, &bank)) {
    const TransportPlan jump{.frame = HeadToPrime(), .layout = app_layout_};
    PrimedRelayout(jump, now_frame, engine_running);
    return true;
  }
  TransportPlan plan{
      .kind = PlanKind::kHandOver,
      .frame = head.stream + lead,
      .base = head.transport + lead,
      .layout = app_layout_,
      .epoch = app_epoch_
  };
  PublishBank(&bank, &plan, now_frame, engine_running);
  CommitPlan(plan, now_frame, engine_running);
  AdoptBank(plan, now_frame, engine_running);
  if (!engine_running || !AwaitVerdict(plan.generation)) return true;
  if (missed_generation_.load(std::memory_order_relaxed) != plan.generation) {
    return true;
  }
  ++missed_handovers_;
  return false;
}

bool Mixer::AwaitVerdict(uint64_t generation) const {
  const auto deadline = std::chrono::steady_clock::now() + kVerdictTimeout;
  while (seen_generation_.load(std::memory_order_acquire) < generation) {
    if (std::chrono::steady_clock::now() > deadline) return false;
    std::this_thread::sleep_for(kVerdictPoll);
  }
  return true;
}

}  // namespace kitbag
