#include "metronome/metronome.h"

#include <algorithm>
#include <cassert>

#include "metronome/grid_bars.h"
#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kMsPerMinute;
using metronome_detail::kMsPerSecond;

void Metronome::SetTempo(double bpm) {
  Command command{CommandType::kSetTempo};
  command.value = bpm;
  commands_.Push(command);
}

// Both halves ride one command: split across two, a block boundary between the
// pushes would sound a block of the old signature's beat rate.
void Metronome::SetTimeSignature(int numerator, int denominator) {
  Command command{CommandType::kSetBeats};
  command.int_a = numerator;
  command.int_b = denominator;
  commands_.Push(command);
}

void Metronome::SetSubdivision(int subdivision) {
  Command command{CommandType::kSetSubdivision};
  command.int_a = subdivision;
  commands_.Push(command);
}

void Metronome::SetSubdivisionAccents(int subdivision, int32_t slot_mask) {
  Command command{CommandType::kSetSubdivisionAccents};
  command.int_a = subdivision;
  command.int_b = slot_mask;
  commands_.Push(command);
}

void Metronome::SetAccent(int beat_index, int32_t accent) {
  Command command{CommandType::kSetAccent};
  command.int_a = beat_index;
  command.int_b = accent;
  commands_.Push(command);
}

void Metronome::SetPolyrhythm(bool enabled, int beats) {
  Command command{CommandType::kSetPoly};
  command.int_a = enabled ? 1 : 0;
  command.int_b = beats;
  commands_.Push(command);
}

void Metronome::SetPolyAccent(int beat_index, int32_t accent) {
  Command command{CommandType::kSetPolyAccent};
  command.int_a = beat_index;
  command.int_b = accent;
  commands_.Push(command);
}

void Metronome::SetPolyAgainst(int main_beats) {
  Command command{CommandType::kSetPolyAgainst};
  command.int_a = main_beats;
  commands_.Push(command);
}

void Metronome::SetSounds(int normal_sound, int accent_sound) {
  Command command{CommandType::kSetSounds};
  command.int_a = normal_sound;
  command.int_b = accent_sound;
  commands_.Push(command);
}

void Metronome::SetCountIn(int bars, bool distinct, int sound) {
  Command command{CommandType::kSetCountIn};
  command.int_a = bars;
  command.int_b = distinct ? 1 : 0;
  command.int_c = sound;
  commands_.Push(command);
}

void Metronome::PreviewSound(int sound, bool accented) {
  Command command{CommandType::kPreviewSound};
  command.int_a = sound;
  command.int_b = accented ? 1 : 0;
  command.int_c = preview_epoch_.load(std::memory_order_relaxed);
  commands_.Push(command);
}

void Metronome::SetVolume(double volume) {
  Command command{CommandType::kSetVolume};
  command.value = volume;
  commands_.Push(command);
}

void Metronome::SetLatencyOffset(double latency_ms) {
  Command command{CommandType::kSetLatencyOffset};
  command.value = latency_ms;
  commands_.Push(command);
}

void Metronome::SetRamp(
    bool enabled,
    double start_bpm,
    double target_bpm,
    double step_bpm,
    double interval,
    int32_t unit,
    bool loop
) {
  Command command{CommandType::kSetRamp};
  command.value = start_bpm;
  command.value_b = target_bpm;
  command.value_c = step_bpm;
  command.value_d = interval;
  command.int_a = enabled ? 1 : 0;
  command.int_b = unit;
  command.int_c = loop ? 1 : 0;
  commands_.Push(command);
}

void Metronome::SetBarMute(bool enabled, int play_bars, int mute_bars) {
  Command command{CommandType::kSetBarMute};
  command.int_a = enabled ? 1 : 0;
  command.int_b = play_bars;
  command.int_c = mute_bars;
  commands_.Push(command);
}

void Metronome::SetFollowMixer(bool enabled) {
  Command command{CommandType::kSetFollowMixer};
  command.int_a = enabled ? 1 : 0;
  commands_.Push(command);
}

void Metronome::SetGrid(
    std::unique_ptr<BeatGrid> grid,
    uint64_t now_frame,
    bool engine_running
) {
  if (grid != nullptr && grid->bars.size() != grid->beat_times_sec.size()) {
    grid->bars = GridBars({}, grid->beat_times_sec.size());
  }
  grid_.Publish(std::move(grid), now_frame, engine_running);
}

void Metronome::ClearGrid(uint64_t now_frame, bool engine_running) {
  grid_.Publish(nullptr, now_frame, engine_running);
}

void Metronome::ReleaseRetiredGrids() {
  grid_.ReclaimAll();
}

void Metronome::ApplyPendingCommands() {
  Command command;
  while (commands_.Pop(&command)) ApplyCommand(command);
  running_flag_.store(running_, std::memory_order_relaxed);
}

void Metronome::ApplyCommand(const Command& command) {
  const bool claimed = RouteCommand(command);
  assert(claimed && "command routed to a handler that does not own its type");
  (void)claimed;
}

// The one exhaustive switch over CommandType: no `default:`, so a new command
// is a -Wswitch error here rather than a command silently dropped at runtime.
bool Metronome::RouteCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kStart:
    case CommandType::kStartAt:
    case CommandType::kStop:
    case CommandType::kPause:
    case CommandType::kAnchorExternal:
      return ApplyTransportCommand(command);
    case CommandType::kSetTempo:
    case CommandType::kSetLatencyOffset:
    case CommandType::kSetFollowMixer:
      return ApplyClockCommand(command);
    case CommandType::kSetRamp:
    case CommandType::kSetBarMute:
    case CommandType::kSetCountIn:
      return ApplyTrainerCommand(command);
    case CommandType::kSetBeats:
    case CommandType::kSetSubdivision:
    case CommandType::kSetSubdivisionAccents:
    case CommandType::kSetAccent:
    case CommandType::kSetPoly:
    case CommandType::kSetPolyAccent:
    case CommandType::kSetPolyAgainst:
      return ApplyPatternCommand(command);
    case CommandType::kSetSounds:
    case CommandType::kPreviewSound:
    case CommandType::kSetVolume:
      return ApplyOutputCommand(command);
  }
  return false;
}

bool Metronome::ApplyClockCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kSetTempo:
      SetBpmPreservingPhase(Clamp(command.value, kMinBpm, kMaxBpm));
      ramp_.Disable();
      return true;
    case CommandType::kSetLatencyOffset:
      SetLatencyPreservingPhase(command.value);
      return true;
    case CommandType::kSetFollowMixer: {
      const bool follow = command.int_a != 0;
      if (follow_mixer_ != follow) grid_state_.last_onset = {};
      follow_mixer_ = follow;
      ReacquireGrid();
      return true;
    }
    default:
      return false;
  }
}

bool Metronome::ApplyTrainerCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kSetRamp:
      ArmRamp(command);
      return true;
    case CommandType::kSetBarMute:
      mute_enabled_ = command.int_a != 0;
      play_bars_ = Clamp(command.int_b, kMinMuteBars, kMaxMuteBars);
      mute_bars_ = Clamp(command.int_c, kMinMuteBars, kMaxMuteBars);
      return true;
    case CommandType::kSetCountIn:
      SetCountInState(command);
      return true;
    default:
      return false;
  }
}

void Metronome::ArmRamp(const Command& command) {
  if (command.int_a == 0) {
    ramp_.Disable();
    return;
  }
  const bool valid = ramp_.Configure(
      command.value,
      command.value_b,
      command.value_c,
      command.value_d,
      command.int_b,
      command.int_c != 0
  );
  if (!valid) return;
  // current_bar_ is -1 before the first downbeat; never start there.
  ramp_.Restart(running_ && current_bar_ > 0 ? current_bar_ : 0);
  SetBpmPreservingPhase(ramp_.start_bpm());
}

void Metronome::SetLatencyPreservingPhase(double latency_ms) {
  const double before = LatencyBeats();
  const double before_ms = latency_offset_ms_;
  latency_offset_ms_ =
      Clamp(latency_ms, -kMaxLatencyOffsetMs, kMaxLatencyOffsetMs);
  if (!running_) return;
  beat_position_ += before - LatencyBeats();
  grid_state_.pending_shift_sec +=
      (latency_offset_ms_ - before_ms) / kMsPerSecond;
}

double Metronome::BeatUnitScale() const {
  return static_cast<double>(denominator_) / kBpmReferenceDenominator;
}

double Metronome::LatencyBeats() const {
  return latency_offset_ms_ * bpm_ * BeatUnitScale() / kMsPerMinute;
}

void Metronome::SetBpmPreservingPhase(double new_bpm) {
  SetBeatRate(new_bpm, denominator_);
}

void Metronome::SetDenominatorPreservingPhase(int32_t denominator) {
  SetBeatRate(bpm_, denominator);
}

// The offset is fixed in ms, so its width in beats rescales with the beat rate.
// Assigning bpm_ or denominator_ directly would step `position` sideways:
// slowing re-crosses the grid point that just fired, speeding up jumps the next.
void Metronome::SetBeatRate(double new_bpm, int new_denominator) {
  const double before = LatencyBeats();
  bpm_ = new_bpm;
  denominator_ = new_denominator;
  beat_position_ += before - LatencyBeats();
}

bool Metronome::BarIsMuted(int64_t bar) const {
  if (!mute_enabled_) return false;
  return bar % (play_bars_ + mute_bars_) >= play_bars_;
}

}  // namespace kitbag
