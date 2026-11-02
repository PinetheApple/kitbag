#include <algorithm>
#include <cmath>
#include <memory>
#include <optional>
#include <utility>

#include "mixer/mixer.h"

namespace kitbag {

float Mixer::ClampRate(float rate) {
  return std::isnan(rate) ? kUnityRate : std::clamp(rate, kMinRate, kMaxRate);
}

int Mixer::ClampPitch(float semitones) {
  if (!std::isfinite(semitones)) return 0;
  const auto clamped = std::clamp(
      semitones,
      static_cast<float>(kMinPitchSemitones),
      static_cast<float>(kMaxPitchSemitones)
  );
  return static_cast<int>(std::lround(clamped));
}

bool Mixer::WantsStretch() const {
  if (app_rate_ != kUnityRate) return true;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    if (tracks_[t].stream->ready() && app_pitch_[t] != 0) return true;
  }
  return false;
}

std::unique_ptr<KeyBusSlot> Mixer::MakeBus(int slot) const {
  auto bus = std::make_unique<KeyBus>();
  bus->Configure(
      sample_rate_,
      slot + kMinPitchSemitones,
      {.vendor_default = app_vendor_default_, .generation = app_bus_generation_}
  );
  return std::make_unique<KeyBusSlot>(KeyBusSlot{std::move(bus)});
}

// Every replacement is configured before any is published, so the callback's
// hold between them is as short as the publishes.
bool Mixer::MatchBusConfig(
    int in_use,
    bool allow_down,
    uint64_t now_frame,
    bool engine_running
) {
  const bool vendor = in_use > TimeStretch::kMaxChosenConfigInstances;
  if (vendor == app_vendor_default_ || (!vendor && !allow_down)) return false;
  app_vendor_default_ = vendor;
  ++app_bus_generation_;
  std::unique_ptr<KeyBusSlot> fresh[kKeyBusCount];
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (buses_[s].Get() != nullptr) fresh[s] = MakeBus(s);
  }
  bool replaced = false;
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (fresh[s] == nullptr) continue;
    buses_[s].Publish(std::move(fresh[s]), now_frame, engine_running);
    replaced = true;
  }
  return replaced;
}

void Mixer::EngageBuses(
    std::optional<int> extra,
    uint64_t now_frame,
    bool engine_running
) {
  const bool was_engaged = app_engaged_;
  app_engaged_ = true;
  bool used[kKeyBusCount] = {};
  MarkUsedBuses(used);
  if (extra) used[*extra - kMinPitchSemitones] = true;
  RetireDrainedBuses(used, now_frame, engine_running);
  const auto in_use =
      static_cast<int>(std::count(used, used + kKeyBusCount, true));
  const bool replaced =
      MatchBusConfig(in_use, false, now_frame, engine_running);
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (used[s] && buses_[s].Get() == nullptr) {
      buses_[s].Publish(MakeBus(s), now_frame, engine_running);
    }
  }
  if (replaced && was_engaged) Reprime(now_frame, engine_running);
}

void Mixer::Reprime(uint64_t now_frame, bool engine_running) {
  const int64_t target = SeekTarget(static_cast<int64_t>(position()));
  Relayout({.frame = target, .layout = app_layout_}, now_frame, engine_running);
}

uint32_t Mixer::LiveBusMask() const {
  uint32_t mask = 0;
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (buses_[s].Get() != nullptr) mask |= 1U << static_cast<unsigned>(s);
  }
  return mask;
}

// Before the stem publishes, so the callback never reads it without a bus.
uint32_t
Mixer::PrepareBusFor(int track, uint64_t now_frame, bool engine_running) {
  if (!app_engaged_ && app_pitch_[track] == 0) return 0;
  const uint32_t before = LiveBusMask();
  EngageBuses(app_pitch_[track], now_frame, engine_running);
  return LiveBusMask() & ~before;
}

void Mixer::UndoPrepare(
    uint32_t created,
    bool was_engaged,
    uint64_t now_frame,
    bool engine_running
) {
  app_engaged_ = was_engaged;
  for (int s = 0; s < kKeyBusCount; ++s) {
    if ((created & (1U << static_cast<unsigned>(s))) != 0) {
      buses_[s].Publish(nullptr, now_frame, engine_running);
    }
  }
}

void Mixer::MarkUsedBuses(bool* used) const {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    if (tracks_[t].stream->ready()) {
      used[app_pitch_[t] - kMinPitchSemitones] = true;
    }
  }
}

void Mixer::RetireDrainedBuses(
    const bool* used,
    uint64_t now_frame,
    bool engine_running
) {
  for (int s = 0; s < kKeyBusCount; ++s) {
    const auto* node = buses_[s].Get();
    if (used[s] || node == nullptr) continue;
    if (node->value.bus->drained.load(std::memory_order_acquire)) {
      buses_[s].Publish(nullptr, now_frame, engine_running);
    }
  }
}

// The config only switches down at a jump, so never mid-play.
void Mixer::FreeUnusedBuses(
    bool at_jump,
    uint64_t now_frame,
    bool engine_running
) {
  bool used[kKeyBusCount] = {};
  if (app_engaged_) MarkUsedBuses(used);
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (!used[s] && buses_[s].Get() != nullptr) {
      buses_[s].Publish(nullptr, now_frame, engine_running);
    }
  }
  const int live = key_bus_count();
  MatchBusConfig(live, at_jump || live == 0, now_frame, engine_running);
}

void Mixer::SetRate(float rate, uint64_t now_frame, bool engine_running) {
  const float clamped = ClampRate(rate);
  if (clamped != kUnityRate) EngageBuses({}, now_frame, engine_running);
  Command command{CommandType::kSetRate};
  command.fvalue = clamped;
  if (Enqueue(command)) app_rate_ = clamped;
}

// The bus is published before the command, so the callback that pops the
// command already sees it. The guard counts the stem at its new key only.
void Mixer::SetTrackPitch(
    int track,
    float semitones,
    uint64_t now_frame,
    bool engine_running
) {
  if (track < 0 || track >= track_count_.load(std::memory_order_relaxed)) {
    return;
  }
  const int pitch = ClampPitch(semitones);
  const int previous = std::exchange(app_pitch_[track], pitch);
  if (pitch != 0 || app_engaged_) EngageBuses(pitch, now_frame, engine_running);
  Command command{CommandType::kSetTrackPitch};
  command.track = track;
  command.fvalue = static_cast<float>(pitch);
  if (!Enqueue(command)) app_pitch_[track] = previous;
}

int Mixer::track_pitch(int track) const {
  return track >= 0 && track < kMaxTracks
             ? tracks_[track].pitch.load(std::memory_order_relaxed)
             : 0;
}

int Mixer::key_bus_count() const {
  int count = 0;
  for (const auto& slot : buses_) count += slot.Get() != nullptr ? 1 : 0;
  return count;
}

}  // namespace kitbag
