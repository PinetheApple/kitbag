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

std::unique_ptr<KeyBusSlot>
Mixer::MakeBus(int slot, uint64_t generation) const {
  auto bus = std::make_unique<KeyBus>();
  bus->Configure(
      sample_rate_,
      slot + kMinPitchSemitones,
      {.vendor_default = app_vendor_default_, .generation = generation}
  );
  return std::make_unique<KeyBusSlot>(KeyBusSlot{std::move(bus)});
}

// Only the flag: the next prime builds every bus in the new config.
bool Mixer::MatchBusConfig(int in_use, bool allow_down) {
  const bool vendor = in_use > TimeStretch::kMaxChosenConfigInstances;
  if (vendor == app_vendor_default_ || (!vendor && !allow_down)) return false;
  app_vendor_default_ = vendor;
  return true;
}

Mixer::BusChange Mixer::EngageBuses(
    std::optional<int> extra,
    uint64_t now_frame,
    bool engine_running
) {
  app_engaged_ = true;
  bool used[kKeyBusCount] = {};
  int in_use = MarkUsedBuses(used);
  if (extra && !used[*extra - kMinPitchSemitones]) {
    used[*extra - kMinPitchSemitones] = true;
    ++in_use;
  }
  RetireDrainedBuses(used, now_frame, engine_running);
  if (MatchBusConfig(in_use, false) || !app_primed_ ||
      !engaged_.load(std::memory_order_relaxed)) {
    return BusChange::kNeedsPrime;
  }
  for (int s = 0; s < kKeyBusCount; ++s) {
    auto& slot = buses_[app_bank_][s];
    if (used[s] && slot.Get() == nullptr) {
      slot.Publish(MakeBus(s, app_bus_generation_), now_frame, engine_running);
    }
  }
  return BusChange::kAddedLive;
}

uint32_t Mixer::LiveBusMask() const {
  uint32_t mask = 0;
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (buses_[app_bank_][s].Get() != nullptr) {
      mask |= 1U << static_cast<unsigned>(s);
    }
  }
  return mask;
}

// Before the stem publishes, so the callback never reads it without a bus.
Mixer::Prepared
Mixer::PrepareBusFor(int track, uint64_t now_frame, bool engine_running) {
  if (!app_engaged_ && app_pitch_[track] == 0) return {};
  const uint32_t before = LiveBusMask();
  const BusChange change =
      EngageBuses(app_pitch_[track], now_frame, engine_running);
  return {
      .created = LiveBusMask() & ~before,
      .prime = change == BusChange::kNeedsPrime
  };
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
      buses_[app_bank_][s].Publish(nullptr, now_frame, engine_running);
    }
  }
}

int Mixer::MarkUsedBuses(bool* used) const {
  int in_use = 0;
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    if (!tracks_[t].stream->ready()) continue;
    bool& slot = used[app_pitch_[t] - kMinPitchSemitones];
    in_use += slot ? 0 : 1;
    slot = true;
  }
  return in_use;
}

int Mixer::BusesInUse() const {
  bool used[kKeyBusCount] = {};
  return MarkUsedBuses(used);
}

void Mixer::RetireDrainedBuses(
    const bool* used,
    uint64_t now_frame,
    bool engine_running
) {
  for (int s = 0; s < kKeyBusCount; ++s) {
    auto& slot = buses_[app_bank_][s];
    const auto* node = slot.Get();
    if (used[s] || node == nullptr) continue;
    if (node->value.bus->drained.load(std::memory_order_acquire)) {
      slot.Publish(nullptr, now_frame, engine_running);
    }
  }
}

void Mixer::FreeUnusedBuses(uint64_t now_frame, bool engine_running) {
  bool used[kKeyBusCount] = {};
  if (app_engaged_) MarkUsedBuses(used);
  for (int s = 0; s < kKeyBusCount; ++s) {
    auto& slot = buses_[app_bank_][s];
    if (!used[s] && slot.Get() != nullptr) {
      slot.Publish(nullptr, now_frame, engine_running);
    }
  }
  if (key_bus_count() == 0) MatchBusConfig(0, true);
}

void Mixer::SetRate(float rate, uint64_t now_frame, bool engine_running) {
  const float clamped = ClampRate(rate);
  Command command{CommandType::kSetRate};
  command.fvalue = clamped;
  if (!Enqueue(command)) return;
  app_rate_ = clamped;
  if (clamped != kUnityRate &&
      EngageBuses({}, now_frame, engine_running) == BusChange::kNeedsPrime) {
    PrimeNow(now_frame, engine_running);
  }
}

// A lazily added bus is published before the command, so the callback that
// pops it already sees it. The guard counts the stem at its new key only.
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
  bool prime = false;
  if (pitch != 0 || app_engaged_) {
    prime =
        EngageBuses(pitch, now_frame, engine_running) == BusChange::kNeedsPrime;
  }
  Command command{CommandType::kSetTrackPitch};
  command.track = track;
  command.fvalue = static_cast<float>(pitch);
  if (!Enqueue(command)) {
    app_pitch_[track] = previous;
    return;
  }
  if (prime) PrimeNow(now_frame, engine_running);
}

int Mixer::track_pitch(int track) const {
  return track >= 0 && track < kMaxTracks
             ? tracks_[track].pitch.load(std::memory_order_relaxed)
             : 0;
}

int Mixer::key_bus_count() const {
  int count = 0;
  for (const auto& bank : buses_) {
    for (const auto& slot : bank) count += slot.Get() != nullptr ? 1 : 0;
  }
  return count;
}

}  // namespace kitbag
