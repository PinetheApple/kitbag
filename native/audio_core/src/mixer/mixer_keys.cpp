#include <algorithm>
#include <cmath>
#include <memory>
#include <optional>

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

void Mixer::PublishBus(int slot, uint64_t now_frame, bool engine_running) {
  auto bus = std::make_unique<KeyBus>();
  bus->Configure(sample_rate_, slot + kMinPitchSemitones, app_vendor_default_);
  buses_[slot].Publish(
      std::make_unique<KeyBusSlot>(KeyBusSlot{std::move(bus)}),
      now_frame,
      engine_running
  );
}

bool Mixer::MatchBusConfig(int live, uint64_t now_frame, bool engine_running) {
  const bool vendor = live > TimeStretch::kMaxChosenConfigInstances;
  if (vendor == app_vendor_default_) return false;
  app_vendor_default_ = vendor;
  bool replaced = false;
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (buses_[s].Get() == nullptr) continue;
    PublishBus(s, now_frame, engine_running);
    replaced = true;
  }
  return replaced;
}

// Buses are configured in the target config before any is published, and
// a config change re-primes like a seek at the audible head.
void Mixer::EngageBuses(
    std::optional<int> extra,
    uint64_t now_frame,
    bool engine_running
) {
  const bool was_engaged = app_engaged_;
  app_engaged_ = true;
  bool wanted[kKeyBusCount] = {};
  MarkUsedBuses(wanted);
  if (extra) wanted[*extra - kMinPitchSemitones] = true;
  int live = 0;
  for (int s = 0; s < kKeyBusCount; ++s) {
    wanted[s] = wanted[s] || buses_[s].Get() != nullptr;
    live += wanted[s] ? 1 : 0;
  }
  const bool replaced = MatchBusConfig(live, now_frame, engine_running);
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (wanted[s] && buses_[s].Get() == nullptr) {
      PublishBus(s, now_frame, engine_running);
    }
  }
  if (replaced && was_engaged) Reprime(now_frame, engine_running);
}

void Mixer::Reprime(uint64_t now_frame, bool engine_running) {
  const int64_t target = SeekTarget(static_cast<int64_t>(position()));
  Relayout({.frame = target, .layout = app_layout_}, now_frame, engine_running);
}

// Before the stem publishes, so the callback never reads it without a bus.
void Mixer::PrepareBusFor(int track, uint64_t now_frame, bool engine_running) {
  if (!app_engaged_ && app_pitch_[track] == 0) return;
  EngageBuses(app_pitch_[track], now_frame, engine_running);
}

void Mixer::MarkUsedBuses(bool* used) const {
  const int count = track_count_.load(std::memory_order_relaxed);
  for (int t = 0; t < count; ++t) {
    if (tracks_[t].stream->ready()) {
      used[app_pitch_[t] - kMinPitchSemitones] = true;
    }
  }
}

bool Mixer::FreeUnusedBuses(uint64_t now_frame, bool engine_running) {
  bool used[kKeyBusCount] = {};
  MarkUsedBuses(used);
  for (int s = 0; s < kKeyBusCount; ++s) {
    if (!used[s] && buses_[s].Get() != nullptr) {
      buses_[s].Publish(nullptr, now_frame, engine_running);
    }
  }
  return MatchBusConfig(key_bus_count(), now_frame, engine_running);
}

void Mixer::SetRate(float rate, uint64_t now_frame, bool engine_running) {
  const float clamped = ClampRate(rate);
  if (clamped != kUnityRate) EngageBuses({}, now_frame, engine_running);
  Command command{CommandType::kSetRate};
  command.fvalue = clamped;
  if (Enqueue(command)) app_rate_ = clamped;
}

// The bus is published before the command, so the callback that pops the
// command already sees it.
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
  if (pitch != 0 || app_engaged_) EngageBuses(pitch, now_frame, engine_running);
  Command command{CommandType::kSetTrackPitch};
  command.track = track;
  command.fvalue = static_cast<float>(pitch);
  if (Enqueue(command)) app_pitch_[track] = pitch;
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
