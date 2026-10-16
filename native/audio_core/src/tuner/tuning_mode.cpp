// Configuration, framing and publication. The per-hop note logic is in
// tuning_mode_track.cpp.
#include "tuner/tuning_mode.h"

#include <algorithm>
#include <cmath>

#include "tuner/tuning_rules.h"

namespace kitbag {

namespace {

constexpr double kMsPerSecond = 1000.0;

// P1: the power of two nearest kFrameSeconds at this rate.
int FrameSizeFor(uint32_t sample_rate) {
  const double target = tuning_rules::kFrameSeconds * sample_rate;
  int size = 1;
  while (size * 2 <= target) size *= 2;
  return target - size < 2 * size - target ? size : 2 * size;
}

int HopsCovering(double seconds, double hop_seconds) {
  return static_cast<int>(std::ceil(seconds / hop_seconds));
}

}  // namespace

bool TuningMode::ValidTuning(
    int32_t instrument,
    const int32_t* string_midis,
    int32_t count
) {
  if (string_midis == nullptr || count < 1 || count > kMaxStrings) {
    return false;
  }
  if (instrument < KB_TUNER_INSTRUMENT_GUITAR ||
      instrument > KB_TUNER_INSTRUMENT_OTHER) {
    return false;
  }
  return std::all_of(string_midis, string_midis + count, [](int32_t midi) {
    return midi >= 0 && midi <= kMaxMidi;
  });
}

void TuningMode::SetTuning(
    int32_t instrument,
    const int32_t* string_midis,
    int32_t count
) {
  std::copy(string_midis, string_midis + count, string_midis_.begin());
  string_count_ = count;
  instrument_ = instrument;
  SetTargetString(KB_TUNER_AUTO_STRING);
}

void TuningMode::SetTargetString(int32_t string_index) {
  const bool automatic = string_index == KB_TUNER_AUTO_STRING;
  mode_ = automatic ? Mode::kAuto : Mode::kManual;
  target_string_ = automatic ? KB_TUNER_NO_STRING : string_index;
  ClearNote();
  Publish();
}

void TuningMode::SetChromatic() {
  mode_ = Mode::kChromatic;
  target_string_ = KB_TUNER_NO_STRING;
  ClearNote();
  Publish();
}

void TuningMode::SetChromaticBand(double low_hz, double high_hz) {
  chromatic_low_hz_ = low_hz;
  chromatic_high_hz_ = high_hz;
  if (mode_ != Mode::kChromatic) return;
  ClearNote();
  Publish();
}

void TuningMode::SetA4(double a4_hz) {
  a4_hz_ = std::clamp(a4_hz, kMinA4Hz, kMaxA4Hz);
}

void TuningMode::ResetNotePresence(double pause_ms) {
  ClearNote();
  quiet_hops_ = 0;
  pending_pause_ms_ = std::max(pause_ms, 0.0);
  pause_hops_ = PauseHops(pending_pause_ms_);
  Publish();
}

// Zero before Init: the pause stays pending until the hop length is known.
int TuningMode::PauseHops(double pause_ms) const {
  if (hop_seconds_ <= 0.0) return 0;
  return static_cast<int>(std::lround(pause_ms / kMsPerSecond / hop_seconds_));
}

void TuningMode::Init(uint32_t sample_rate) {
  frame_size_ = FrameSizeFor(sample_rate);
  hop_size_ = frame_size_ / 2;
  hop_seconds_ = static_cast<double>(hop_size_) / sample_rate;
  history_.assign(static_cast<size_t>(frame_size_), 0.0f);
  frame_.assign(static_cast<size_t>(frame_size_), 0.0f);
  detector_.Init(frame_size_, sample_rate);
  write_ = 0;
  filled_ = 0;
  until_hop_ = hop_size_;
  DeriveHopCounts();
  ClearNote();
  quiet_hops_ = 0;
  pause_hops_ = PauseHops(pending_pause_ms_);
  Publish();
}

void TuningMode::DeriveHopCounts() {
  ratio_hops_ = static_cast<int>(
      std::lround(tuning_rules::kTimeToFullyInTune / hop_seconds_)
  );
  no_sound_hops_ = HopsCovering(tuning_rules::kNoSoundSeconds, hop_seconds_);
  const int level_hops =
      HopsCovering(tuning_rules::kMicLevelSeconds, hop_seconds_);
  levels_.assign(static_cast<size_t>(level_hops), 0.0);
  level_next_ = 0;
  // P23 is "more than" the dwell, so one hop past the whole hops it spans.
  const auto dwell_hops =
      static_cast<int>(tuning_rules::kWrongStringDwellSeconds / hop_seconds_);
  manual_hint_.Init(dwell_hops + 1);
}

void TuningMode::Process(const float* samples, uint32_t frame_count) {
  if (frame_size_ == 0) return;
  for (uint32_t i = 0; i < frame_count; ++i) {
    history_[static_cast<size_t>(write_)] = samples[i];
    write_ = (write_ + 1) % frame_size_;
    filled_ = std::min(filled_ + 1, frame_size_);
    if (--until_hop_ > 0) continue;
    until_hop_ = hop_size_;
    OnHop();
  }
}

// Paused audio is never analysed: the first frame after the pause is new.
void TuningMode::AdvancePause() {
  pending_pause_ms_ = 0.0;
  if (--pause_hops_ == 0) filled_ = 0;
  Publish();
}

// Oldest sample first; returns the frame's RMS.
double TuningMode::UnwrapFrame() {
  const auto split = history_.begin() + write_;
  std::copy(split, history_.end(), frame_.begin());
  std::copy(history_.begin(), split, frame_.end() - write_);
  double energy = 0.0;
  for (const float sample : frame_) energy += sample * sample;
  return std::sqrt(energy / frame_size_);
}

void TuningMode::RecordLevel(double rms) {
  levels_[static_cast<size_t>(level_next_)] = rms;
  level_next_ = (level_next_ + 1) % static_cast<int>(levels_.size());
}

void TuningMode::AnalysisRange(double* low_hz, double* high_hz) const {
  if (mode_ == Mode::kChromatic || string_count_ == 0) {
    *low_hz = chromatic_low_hz_;
    *high_hz = chromatic_high_hz_;
    return;
  }
  const auto* end = string_midis_.begin() + string_count_;
  const auto [lowest, highest] =
      std::minmax_element(string_midis_.begin(), end);
  *low_hz = tuning_rules::HzForMidi(
      *lowest - tuning_rules::kRangeBelowLowest,
      a4_hz_
  );
  *high_hz = tuning_rules::HzForMidi(
      *highest + tuning_rules::kRangeAboveHighest,
      a4_hz_
  );
}

kb_tuner_state TuningMode::RestState() {
  kb_tuner_state state{};
  state.current_string = KB_TUNER_NO_STRING;
  state.possible_wrong_string = KB_TUNER_NO_STRING;
  state.wrong_string_direction = KB_WRONG_STRING_NONE;
  state.tuning_status = KB_TUNING_NOT_MEASURED;
  state.target_midi = KB_TUNER_NO_NOTE;
  return state;
}

void TuningMode::Publish() {
  const uint32_t id = state_.measurement_id;
  state_ = RestState();
  state_.measurement_id = id;
  state_.listening_paused = pause_hops_ > 0 || pending_pause_ms_ > 0.0 ? 1 : 0;
  state_.no_sound_issue =
      no_sound_hops_ > 0 && quiet_hops_ >= no_sound_hops_ ? 1 : 0;
  state_.mic_rms =
      levels_.empty() ? 0.0 : *std::max_element(levels_.begin(), levels_.end());
  if (note_present_) PublishNote();
  PublishHint();
}

void TuningMode::PublishNote() {
  const double midi =
      missed_hops_ > 0 ? smoother_.held() : smoother_.smoothed();
  const double error = (midi - target_midi_) * tuning_rules::kCentsPerSemitone;
  state_.can_hear_note = 1;
  state_.current_string = current_string_;
  state_.target_midi = target_midi_;
  state_.measured_midi = midi;
  state_.measured_hz = tuning_rules::HzForMidi(midi, a4_hz_);
  state_.tuning_error_cents = error;
  state_.tuning_status = tuning_rules::StatusForError(error);
  state_.in_tune_threshold_cents =
      tuning_rules::InTuneWindowCents(instrument_, target_midi_);
  state_.in_tune_ratio =
      static_cast<double>(in_window_hops_) / std::max(ratio_hops_, 1);
}

void TuningMode::PublishHint() {
  if (mode_ == Mode::kManual) {
    state_.possible_wrong_string = manual_hint_.string();
    state_.wrong_string_direction = manual_hint_.direction();
    return;
  }
  if (mode_ != Mode::kAuto || auto_hint_ == KB_TUNER_NO_STRING) return;
  state_.possible_wrong_string = auto_hint_;
  state_.wrong_string_direction =
      string_midis_[static_cast<size_t>(auto_hint_)] < target_midi_
          ? KB_WRONG_STRING_BELOW
          : KB_WRONG_STRING_ABOVE;
}

}  // namespace kitbag
