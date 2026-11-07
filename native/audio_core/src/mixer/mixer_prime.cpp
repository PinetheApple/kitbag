#include <algorithm>
#include <chrono>
#include <memory>
#include <thread>
#include <utility>
#include <vector>

#include "mixer/mixer.h"

namespace kitbag {
namespace {

constexpr auto kVerdictTimeout = std::chrono::milliseconds(500);
constexpr auto kVerdictPoll = std::chrono::microseconds(500);

}  // namespace

// Playing in bypass hands over ahead of the head, so playback never stops.
bool Mixer::PrimeNow(FrameClock clock, bool engine_running) {
  if (!app_engaged_ || BusesInUse() == 0) return true;
  if (app_playing_ && !engaged_.load(std::memory_order_relaxed)) {
    return HandOver(clock, engine_running);
  }
  return PrimedRelayout(ReprimePlan(), clock, engine_running);
}

bool Mixer::PrimeAwaitingEngage() const {
  return app_primed_ && app_playing_ &&
         !engaged_.load(std::memory_order_relaxed);
}

TransportPlan Mixer::ReprimePlan() const {
  const Head head = PlannedHead();
  const bool audible =
      !head.jump_pending && engaged_.load(std::memory_order_relaxed);
  const int64_t frame = audible ? static_cast<int64_t>(position())
                                : app_layout_.SongFrameAt(head.stream);
  return {
      .frame = SeekTarget(frame),
      .layout = app_layout_,
      .continues_run = !head.jump_pending
  };
}

bool Mixer::PrimedRelayout(
    TransportPlan plan,
    FrameClock clock,
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
  if (!BuildBank(plan.frame, true, &bank)) {
    DropStaged(track_count_.load(std::memory_order_relaxed));
    return false;
  }
  if (prime_publish_hook_) prime_publish_hook_();
  PublishBank(&bank, &plan, clock, engine_running);
  CommitPlan(plan, clock, engine_running);
  AdoptBank(plan, clock, engine_running);
  return true;
}

bool Mixer::StageAll(
    int64_t frame,
    const SourceStamp& stamp,
    bool engine_running
) {
  const int count = track_count_.load(std::memory_order_relaxed);
  const auto target = static_cast<uint64_t>(std::max<int64_t>(frame, 0));
  for (int i = 0; i < count; ++i) {
    if (tracks_[i].stream->Stage(target, stamp, engine_running)) continue;
    DropStaged(i);
    return false;
  }
  return true;
}

void Mixer::DropStaged(int count) {
  for (int t = 0; t < count; ++t) tracks_[t].stream->DropStaged();
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

// Every loaded stem is read, muted or not.
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

void Mixer::PublishBank(
    Bank* bank,
    TransportPlan* plan,
    FrameClock clock,
    bool engine_running
) {
  const int idle_bank = 1 - app_bank_;
  for (int s = 0; s < kKeyBusCount; ++s) {
    buses_[idle_bank][s]
        .Publish(std::move(bank->slots[s]), clock.Now(), engine_running);
  }
  plan->primed = true;
  plan->bank = idle_bank;
  plan->generation = bank->generation;
  plan->rate = app_rate_;
  plan->lag = bank->lag;
}

void Mixer::AdoptBank(
    const TransportPlan& plan,
    FrameClock clock,
    bool engine_running
) {
  FreeBank(app_bank_, clock, engine_running);
  app_bank_ = plan.bank;
  app_bus_generation_ = plan.generation;
  app_primed_ = true;
}

void Mixer::FreeBank(int bank, FrameClock clock, bool engine_running) {
  for (auto& slot : buses_[bank]) {
    if (slot.Get() != nullptr) {
      slot.Publish(nullptr, clock.Now(), engine_running);
    }
  }
}

// A missed switch point is never adopted late: the next attempt picks a new
// one further ahead, and the last resort is a primed jump.
bool Mixer::HandOver(FrameClock clock, bool engine_running) {
  bool stalled = false;
  for (int attempt = 0; attempt < kHandOverAttempts; ++attempt) {
    const Head head = PlannedHead();
    if (head.jump_pending || engaged_.load(std::memory_order_relaxed)) break;
    const int64_t lead = attempt == 0 && first_lead_frames_ != 0
                             ? first_lead_frames_
                             : handover_lead_frames_ << attempt;
    first_lead_frames_ = 0;
    const HandOverOutcome outcome =
        TryHandOver(head, lead, clock, engine_running);
    if (outcome == HandOverOutcome::kTaken) return true;
    stalled = outcome == HandOverOutcome::kStalled;
    if (outcome != HandOverOutcome::kMissed) break;
  }
  if (PrimedRelayout(ReprimePlan(), clock, engine_running)) return true;
  if (stalled) RetractHandOver(clock, engine_running);
  return false;
}

// The stalled callback may yet wake to the plan of a change now refused; a keep
// at the head, in the same epoch, supersedes it and touches no source.
void Mixer::RetractHandOver(FrameClock clock, bool engine_running) {
  const Head head = PlannedHead();
  const TransportPlan keep{
      .kind = PlanKind::kKeep,
      .frame = head.stream,
      .base = head.transport,
      .layout = app_layout_,
      .epoch = app_epoch_
  };
  CommitPlan(keep, clock, engine_running);
  FreeBank(1 - app_bank_, clock, engine_running);
}

// Adopted only once taken: the callback may engage the live bank at any block
// until it judges this plan, so freeing that bank earlier silences it.
Mixer::HandOverOutcome Mixer::TryHandOver(
    const Head& head,
    int64_t lead,
    FrameClock clock,
    bool engine_running
) {
  Bank bank;
  if (!BuildBank(head.stream + lead, false, &bank)) {
    return HandOverOutcome::kNotBuilt;
  }
  if (prime_publish_hook_) prime_publish_hook_();
  TransportPlan plan{
      .kind = PlanKind::kHandOver,
      .frame = head.stream + lead,
      .base = head.transport + lead,
      .layout = app_layout_,
      .epoch = app_epoch_
  };
  PublishBank(&bank, &plan, clock, engine_running);
  CommitPlan(plan, clock, engine_running);
  const HandOverOutcome outcome = AwaitVerdict(plan.generation, engine_running);
  if (outcome == HandOverOutcome::kTaken) {
    AdoptBank(plan, clock, engine_running);
  } else if (outcome == HandOverOutcome::kMissed) {
    FreeBank(plan.bank, clock, engine_running);
    ++missed_handovers_;
  }
  return outcome;
}

// A quiescent callback cannot have moved since the caller's engaged check. No
// verdict in time means it stalled: only a jump supersedes either answer.
Mixer::HandOverOutcome
Mixer::AwaitVerdict(uint64_t generation, bool engine_running) const {
  if (!engine_running) return HandOverOutcome::kTaken;
  const auto deadline = std::chrono::steady_clock::now() + kVerdictTimeout;
  while (seen_generation_.load(std::memory_order_acquire) < generation) {
    if (std::chrono::steady_clock::now() > deadline) {
      return HandOverOutcome::kStalled;
    }
    std::this_thread::sleep_for(kVerdictPoll);
  }
  return missed_generation_.load(std::memory_order_relaxed) == generation
             ? HandOverOutcome::kMissed
             : HandOverOutcome::kTaken;
}

int64_t Mixer::handover_lead_frames() const {
  return handover_lead_frames_;
}

void Mixer::set_first_handover_lead_frames(int64_t frames) {
  first_lead_frames_ = frames;
}

void Mixer::set_prime_publish_hook(std::function<void()> hook) {
  prime_publish_hook_ = std::move(hook);
}

void Mixer::set_snapshot_hook(std::function<void()> hook) {
  snapshot_hook_ = std::move(hook);
}

uint64_t Mixer::missed_handovers() const {
  return missed_handovers_;
}

}  // namespace kitbag
