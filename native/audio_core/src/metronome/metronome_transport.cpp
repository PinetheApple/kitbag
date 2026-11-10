#include "metronome/metronome.h"

namespace kitbag {

void Metronome::Start() {
  commands_.Push({CommandType::kStart});
}

void Metronome::StartAt(uint64_t start_frame) {
  Command command{CommandType::kStartAt};
  command.frame = start_frame;
  commands_.Push(command);
}

bool Metronome::CountInAt(
    uint64_t end_frame,
    double beat_frames,
    int beats_per_bar
) {
  Command command{CommandType::kCountInAt};
  command.frame = end_frame;
  command.value = beat_frames;
  command.int_a = beats_per_bar;
  return commands_.Push(command);
}

void Metronome::Stop() {
  commands_.Push({CommandType::kStop});
}

void Metronome::Pause() {
  commands_.Push({CommandType::kPause});
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

bool Metronome::ApplyTransportCommand(const Command& command) {
  switch (command.type) {
    case CommandType::kStart:
      // The most recent transport call wins: cancel a deferred start or anchor.
      has_pending_start_ = false;
      has_pending_anchor_ = false;
      BeginRun();
      return true;
    case CommandType::kStartAt:
      DeferStart(command);
      return true;
    case CommandType::kCountInAt:
      ArmCountInAt(command);
      return true;
    case CommandType::kAnchorExternal:
      StashPendingAnchor(command);
      return true;
    case CommandType::kStop:
      StopRun();
      return true;
    case CommandType::kPause:
      PauseRun();
      return true;
    default:
      return false;
  }
}

// Deferred to the render loop; ignored while running, where re-anchoring
// a live click is set_grid's or anchor_external's job.
void Metronome::DeferStart(const Command& command) {
  if (running_) return;
  has_pending_start_ = true;
  pending_start_frame_ = command.frame;
  count_in_at_.Clear();
}

void Metronome::StashPendingAnchor(const Command& command) {
  has_pending_anchor_ = true;
  pending_anchor_song_pos_ = command.value;
  pending_anchor_bpm_ = command.value_b;
  pending_anchor_frame_ = command.frame;
}

void Metronome::StopRun() {
  running_ = false;
  has_pending_start_ = false;
  has_pending_anchor_ = false;  // a Stop cancels a queued anchor too
  // Force a re-seed next block: a cursor stranded where the pause began
  // swallows every beat the pause spanned into one off-grid click (§4.2.1).
  ReacquireGrid();
  counting_in_ = false;
  count_in_armed_ = true;
  count_in_at_.Clear();
  current_beat_.store(-1, std::memory_order_relaxed);
  current_poly_beat_.store(-1, std::memory_order_relaxed);
}

void Metronome::BeginRun() {
  current_bar_ = -1;  // the first downbeat advances it to bar 0
  ramp_.Restart(0);
  if (ramp_.enabled()) bpm_ = ramp_.start_bpm();
  // Anchors `position` at zero: nothing emits before the first frame, so a
  // positive offset would swallow every grid point it shifts past (§4.7).
  ArmCountIn();
  count_in_at_.Clear();
  beat_position_ = -count_in_beats_ - LatencyBeats();
  running_ = true;
  grid_state_.last_onset = {};
  ReacquireGrid();
  // Publish now, not only at the end of the drain: a deferred StartAt calls
  // BeginRun from the render loop, after the drain already stored the flag.
  running_flag_.store(true, std::memory_order_relaxed);
}

// The bar count-in stays unarmed: this count replaces it, and the run it
// starts at the end is a plain start.
void Metronome::ArmCountInAt(const Command& command) {
  StopRun();
  count_in_armed_ = false;
  has_pending_start_ = true;
  pending_start_frame_ = command.frame;
  count_in_at_.Arm(
      command.frame,
      command.value,
      command.int_a,
      count_in_bars_,
      count_in_voice_
  );
}

bool Metronome::ScheduledCountInLive() const {
  return has_pending_start_ && count_in_at_.armed();
}

void Metronome::RenderPendingStart(
    const GridView& view,
    uint64_t now,
    uint32_t sample_rate,
    BlockTempo* tempo
) {
  if (now >= pending_start_frame_) {
    BeginPendingStart(view, now, sample_rate, tempo);
    return;
  }
  if (!ScheduledCountInLive()) return;
  const int index = count_in_at_.BeatAt(now);
  if (index != CountInSchedule::kNoBeat) {
    OnCountInBeat(index, count_in_at_.voice(), sample_rate);
  }
}

}  // namespace kitbag
