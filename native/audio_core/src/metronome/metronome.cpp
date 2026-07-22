// Command API, the RT-side drain, and the sequencer state helpers both render
// paths share. Render loop: metronome_render.cpp. Grid mode: metronome_grid.cpp.
#include "metronome/metronome.h"

#include <cassert>

#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kMsPerMinute;

void Metronome::Start() {
  commands_.Push({CommandType::kStart});
}

void Metronome::StartAt(uint64_t start_frame) {
  Command command{CommandType::kStartAt};
  command.frame = start_frame;
  commands_.Push(command);
}

void Metronome::Stop() {
  commands_.Push({CommandType::kStop});
}

void Metronome::AnchorExternal(
    double song_pos_sec,
    uint64_t at_frame,
    double bpm
) {
  Command command{CommandType::kAnchorExternal};
  command.value = song_pos_sec;
  command.value_b = bpm;
  command.frame = at_frame;
  commands_.Push(command);
}

void Metronome::SetTempo(double bpm) {
  Command command{CommandType::kSetTempo};
  command.value = bpm;
  commands_.Push(command);
}

void Metronome::SetBeatsPerBar(int beats) {
  Command command{CommandType::kSetBeats};
  command.int_a = beats;
  commands_.Push(command);
}

void Metronome::SetSubdivision(int subdivision) {
  Command command{CommandType::kSetSubdivision};
  command.int_a = subdivision;
  commands_.Push(command);
}

void Metronome::SetAccent(int beat_index, Accent accent) {
  Command command{CommandType::kSetAccent};
  command.int_a = beat_index;
  command.int_b = static_cast<int32_t>(accent);
  commands_.Push(command);
}

void Metronome::SetPolyrhythm(bool enabled, int beats) {
  Command command{CommandType::kSetPoly};
  command.int_a = enabled ? 1 : 0;
  command.int_b = beats;
  commands_.Push(command);
}

void Metronome::SetSound(int sound_index) {
  Command command{CommandType::kSetSound};
  command.int_a = sound_index;
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
    double end_bpm,
    int bars
) {
  Command command{CommandType::kSetRamp};
  command.value = start_bpm;
  command.value_b = end_bpm;
  command.int_a = enabled ? 1 : 0;
  command.int_b = bars;
  commands_.Push(command);
}

void Metronome::SetBarMute(bool enabled, int play_bars, int mute_bars) {
  Command command{CommandType::kSetBarMute};
  command.int_a = enabled ? 1 : 0;
  command.int_b = play_bars;
  command.int_c = mute_bars;
  commands_.Push(command);
}

void Metronome::SetGrid(
    std::unique_ptr<BeatGrid> grid,
    uint64_t now_frame,
    bool engine_running
) {
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

// The one exhaustive switch over CommandType: no `default:`, so a new command
// is a -Wswitch error here rather than a command silently dropped at runtime.
void Metronome::ApplyCommand(const Command& command) {
  bool claimed = false;
  switch (command.type) {
    case CommandType::kStart:
    case CommandType::kStartAt:
    case CommandType::kStop:
    case CommandType::kAnchorExternal:
      claimed = ApplyTransportCommand(command);
      break;
    case CommandType::kSetTempo:
    case CommandType::kSetLatencyOffset:
      claimed = ApplyTempoCommand(command);
      break;
    case CommandType::kSetRamp:
    case CommandType::kSetBarMute:
      claimed = ApplyTrainerCommand(command);
      break;
    case CommandType::kSetBeats:
    case CommandType::kSetSubdivision:
    case CommandType::kSetAccent:
    case CommandType::kSetPoly:
    case CommandType::kSetSound:
    case CommandType::kSetVolume:
      claimed = ApplyPatternCommand(command);
      break;
  }
  assert(claimed && "command routed to a handler that does not own its type");
  (void)claimed;
}

bool Metronome::ApplyTransportCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kStart:
      // The most recent transport call wins: cancel a deferred start or anchor.
      has_pending_start_ = false;
      has_pending_anchor_ = false;
      BeginRun();
      return true;
    case CommandType::kStartAt:
      // Deferred to the render loop; ignored while running, where re-anchoring
      // a live click is set_grid's or anchor_external's job.
      if (!running_) {
        has_pending_start_ = true;
        pending_start_frame_ = command.frame;
      }
      return true;
    case CommandType::kAnchorExternal:
      StashPendingAnchor(command);
      return true;
    case CommandType::kStop:
      StopRun();
      return true;
    default:
      return false;
  }
}

void Metronome::StashPendingAnchor(const Command& command) {
  has_pending_anchor_ = true;
  pending_anchor_song_pos_ = command.value;
  pending_anchor_bpm_ = command.value_b;
  pending_anchor_frame_ = command.frame;
}

bool Metronome::ApplyTempoCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kSetTempo:
      SetBpmPreservingPhase(Clamp(command.value, kMinBpm, kMaxBpm));
      ramp_enabled_ = false;  // a manual tempo change cancels the ramp
      return true;
    case CommandType::kSetLatencyOffset:
      SetLatencyPreservingPhase(command.value);
      return true;
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
      play_bars_ = Clamp(command.int_b, 1, kMaxMuteBars);
      mute_bars_ = Clamp(command.int_c, 1, kMaxMuteBars);
      return true;
    default:
      return false;
  }
}

bool Metronome::ApplyPatternCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kSetBeats:
      beats_per_bar_ = Clamp(command.int_a, 1, kMaxBeats);
      return true;
    case CommandType::kSetSubdivision:
      subdivision_ = Clamp(command.int_a, 1, kMaxSubdivision);
      return true;
    case CommandType::kSetAccent:
      SetAccentSlot(command.int_a, command.int_b);
      return true;
    case CommandType::kSetPoly:
      SetPolyState(command.int_a != 0, command.int_b);
      return true;
    case CommandType::kSetSound:
      sound_ = Clamp(command.int_a, 0, kSoundCount - 1);
      return true;
    case CommandType::kSetVolume:
      volume_ = Clamp(command.value, 0.0, kMaxVolume);
      return true;
    default:
      return false;
  }
}

void Metronome::SetAccentSlot(int32_t beat_index, int32_t accent) {
  if (beat_index < 0 || beat_index >= kMaxBeats) return;
  accents_[beat_index] = static_cast<Accent>(
      Clamp(accent, 0, static_cast<int32_t>(Accent::kAccented))
  );
}

void Metronome::SetPolyState(bool enabled, int32_t beats) {
  poly_enabled_ = enabled;
  poly_beats_ = Clamp(beats, 2, kMaxPolyBeats);
  if (!poly_enabled_) {
    current_poly_beat_.store(-1, std::memory_order_relaxed);
  }
}

void Metronome::ArmRamp(const Command& command) {
  ramp_enabled_ = command.int_a != 0;
  if (!ramp_enabled_) return;
  ramp_start_bpm_ = Clamp(command.value, kMinBpm, kMaxBpm);
  ramp_end_bpm_ = Clamp(command.value_b, kMinBpm, kMaxBpm);
  ramp_bars_ = Clamp(command.int_b, 1, kMaxRampBars);
  // current_bar_ is -1 before the first downbeat; never start there.
  ramp_start_bar_ = running_ && current_bar_ > 0 ? current_bar_ : 0;
  SetBpmPreservingPhase(ramp_start_bpm_);
}

void Metronome::SetLatencyPreservingPhase(double latency_ms) {
  const double before = LatencyBeats();
  latency_offset_ms_ =
      Clamp(latency_ms, -kMaxLatencyOffsetMs, kMaxLatencyOffsetMs);
  if (running_) {
    beat_position_ += before - LatencyBeats();
  }
}

void Metronome::StopRun() {
  running_ = false;
  has_pending_start_ = false;
  has_pending_anchor_ = false;  // a Stop cancels a queued anchor too
  // Force a re-seed next block: a cursor stranded where the pause began
  // swallows every beat the pause spanned into one off-grid click (§4.2.1).
  observed_generation_ = 0;
  current_beat_.store(-1, std::memory_order_relaxed);
  current_poly_beat_.store(-1, std::memory_order_relaxed);
}

void Metronome::BeginRun() {
  current_bar_ = -1;  // the first downbeat advances it to bar 0
  ramp_start_bar_ = 0;
  if (ramp_enabled_) {
    bpm_ = ramp_start_bpm_;
  }
  // Anchors `position` at zero, not beat_position_: nothing can be emitted
  // before the first frame, so a positive offset would swallow every grid
  // point it shifts past (§4.7).
  beat_position_ = -LatencyBeats();
  running_ = true;
  observed_generation_ = 0;  // re-seed the grid cursor at the resume point
  // Publish now, not only at the end of the drain: a deferred StartAt calls
  // BeginRun from the render loop, after the drain already stored the flag.
  running_flag_.store(true, std::memory_order_relaxed);
}

double Metronome::LatencyBeats() const {
  return latency_offset_ms_ * bpm_ / kMsPerMinute;
}

// The offset is fixed in ms, so its width in beats rescales with the tempo.
// Assigning bpm_ directly would step `position` sideways: ramping down
// re-crosses the grid point that just fired, ramping up jumps over the next.
void Metronome::SetBpmPreservingPhase(double new_bpm) {
  const double before = LatencyBeats();
  bpm_ = new_bpm;
  beat_position_ += before - LatencyBeats();
}

double Metronome::RampBpmForBar(int64_t bar) const {
  const int64_t progressed =
      Clamp<int64_t>(bar - ramp_start_bar_, 0, ramp_bars_);
  const double step = (ramp_end_bpm_ - ramp_start_bpm_) / ramp_bars_;
  return ramp_start_bpm_ + step * static_cast<double>(progressed);
}

bool Metronome::BarIsMuted(int64_t bar) const {
  if (!mute_enabled_) return false;
  return bar % (play_bars_ + mute_bars_) >= play_bars_;
}

}  // namespace kitbag
