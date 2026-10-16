// Per-hop note logic: string choice, the confidence counter, smoothing, the
// in-tune ratio and the release hold (docs/tuner-functional-spec.md §4).
#include <algorithm>
#include <cmath>

#include "tuner/tuning_mode.h"
#include "tuner/tuning_rules.h"

namespace kitbag {

void TuningMode::OnHop() {
  if (pause_hops_ > 0) {
    AdvancePause();
    return;
  }
  ++state_.measurement_id;
  const double rms = UnwrapFrame();
  RecordLevel(rms);
  PitchDetector::Estimate estimate;
  if (filled_ == frame_size_ && rms >= tuning_rules::kMinRms) {
    double low_hz = 0.0;
    double high_hz = 0.0;
    AnalysisRange(&low_hz, &high_hz);
    estimate =
        detector_.Detect(frame_.data(), low_hz, high_hz, mode_ == Mode::kAuto);
  }
  if (estimate.hz > 0.0 && estimate.clarity >= tuning_rules::kMinClarity) {
    hop_clarity_ = estimate.clarity;
    OnPitch(tuning_rules::MidiForHz(estimate.hz, a4_hz_), rms);
  } else {
    NoteMissed();
    manual_hint_.Interrupt();
  }
  quiet_hops_ = note_present_ ? 0 : quiet_hops_ + 1;
  Publish();
}

void TuningMode::OnPitch(double midi, double rms) {
  switch (mode_) {
    case Mode::kChromatic:
      Track(midi, KB_TUNER_NO_STRING);
      return;
    case Mode::kManual:
      Track(midi, target_string_);
      UpdateManualHint(midi, rms);
      return;
    case Mode::kAuto:
      OnAutoPitch(midi);
      return;
  }
}

// P10/P11: the nearest string within kAutoStringCents is heard; a held string
// is given up only after the counter drains.
void TuningMode::OnAutoPitch(double midi) {
  const int32_t nearest = NearestString(midi);
  if (nearest == KB_TUNER_NO_STRING) {
    NoteMissed();
    return;
  }
  const double offset_cents =
      std::fabs(midi - string_midis_[static_cast<size_t>(nearest)]) *
      tuning_rules::kCentsPerSemitone;
  const bool names_string = offset_cents <= tuning_rules::kAutoStringCents;
  if (current_string_ == KB_TUNER_NO_STRING) {
    if (!names_string) return;
    Track(midi, nearest);
  } else if (names_string && SameNote(nearest, current_string_)) {
    auto_hint_ = KB_TUNER_NO_STRING;
    Track(midi, current_string_);
  } else {
    LoseConfidence(names_string ? nearest : KB_TUNER_NO_STRING);
  }
}

void TuningMode::LoseConfidence(int32_t named_string) {
  const bool other_string = named_string != KB_TUNER_NO_STRING &&
                            !SameNote(named_string, current_string_);
  if (other_string) auto_hint_ = named_string;
  confidence_ -= other_string ? tuning_rules::kOtherStringCost
                              : tuning_rules::kStrayPitchCost;
  if (confidence_ <= 0) {
    ClearNote();
  } else {
    ++missed_hops_;
  }
}

void TuningMode::Track(double midi, int32_t string) {
  smoother_.Add(midi);
  const int32_t target =
      string == KB_TUNER_NO_STRING
          ? static_cast<int32_t>(std::lround(smoother_.smoothed()))
          : string_midis_[static_cast<size_t>(string)];
  if (target != target_midi_) in_window_hops_ = 0;
  note_present_ = true;
  confidence_ = std::min(confidence_ + 1, tuning_rules::kMaxConfidence);
  current_string_ = string;
  target_midi_ = target;
  missed_hops_ = 0;
  clarity_ = hop_clarity_;
  const double error_cents =
      (smoother_.smoothed() - target) * tuning_rules::kCentsPerSemitone;
  const bool inside = std::fabs(error_cents) <=
                      tuning_rules::InTuneWindowCents(instrument_, target);
  in_window_hops_ = inside ? std::min(in_window_hops_ + 1, ratio_hops_) : 0;
}

// P27: a hop without the note drains the counter, so a short pluck is held
// for fewer hops than a sustained one.
void TuningMode::NoteMissed() {
  if (!note_present_) return;
  ++missed_hops_;
  confidence_ -= tuning_rules::kReleaseDrain;
  if (confidence_ <= 0) ClearNote();
}

void TuningMode::ClearNote() {
  note_present_ = false;
  current_string_ = KB_TUNER_NO_STRING;
  target_midi_ = KB_TUNER_NO_NOTE;
  confidence_ = 0;
  missed_hops_ = 0;
  in_window_hops_ = 0;
  clarity_ = 0.0;
  smoother_.Reset();
  manual_hint_.Reset();
  auto_hint_ = KB_TUNER_NO_STRING;
}

// P24: strings tuned to one pitch are one note.
bool TuningMode::SameNote(int32_t string_a, int32_t string_b) const {
  return string_midis_[static_cast<size_t>(string_a)] ==
         string_midis_[static_cast<size_t>(string_b)];
}

int32_t TuningMode::NearestString(double midi) const {
  int32_t nearest = KB_TUNER_NO_STRING;
  double best = 0.0;
  for (int32_t i = 0; i < string_count_; ++i) {
    const double distance =
        std::fabs(midi - string_midis_[static_cast<size_t>(i)]);
    if (nearest == KB_TUNER_NO_STRING || distance < best) {
      nearest = i;
      best = distance;
    }
  }
  return nearest;
}

void TuningMode::UpdateManualHint(double midi, double rms) {
  const int32_t nearest = NearestString(midi);
  const auto target = static_cast<size_t>(target_string_);
  manual_hint_.Update({
      .midi = midi,
      .rms = rms,
      .target_midi = static_cast<double>(string_midis_[target]),
      .nearest = nearest,
      .nearest_on_target = SameNote(nearest, target_string_),
  });
}

}  // namespace kitbag
