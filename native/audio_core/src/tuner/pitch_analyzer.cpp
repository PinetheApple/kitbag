#include "tuner/pitch_analyzer.h"

#include <cmath>

#include "tuner/tuning_rules.h"

namespace kitbag {

int32_t NoteIndexForFrequency(double frequency_hz, double a4_hz) {
  if (frequency_hz <= 0.0) return -1;
  return static_cast<int32_t>(
      std::lround(tuning_rules::MidiForHz(frequency_hz, a4_hz))
  );
}

double CentsOffsetForFrequency(double frequency_hz, double a4_hz) {
  if (frequency_hz <= 0.0) return 0.0;
  const double midi = tuning_rules::MidiForHz(frequency_hz, a4_hz);
  return (midi - std::lround(midi)) * tuning_rules::kCentsPerSemitone;
}

PitchAnalyzer::PitchAnalyzer(double sample_rate, double low_hz, double high_hz)
    : band_low_hz_(low_hz), band_high_hz_(high_hz) {
  mode_.SetChromaticBand(low_hz, high_hz);
  mode_.SetChromatic();
  mode_.Init(static_cast<uint32_t>(sample_rate));
}

void PitchAnalyzer::SetA4(double a4_hz) {
  mode_.SetA4(a4_hz);
}

void PitchAnalyzer::SetBand(double low_hz, double high_hz) {
  if (low_hz <= 0.0 || high_hz <= low_hz) return;
  band_low_hz_ = low_hz;
  band_high_hz_ = high_hz;
  mode_.SetChromaticBand(low_hz, high_hz);
  reading_ = Reading{};
}

bool PitchAnalyzer::Process(float sample) {
  mode_.Process(&sample, 1);
  const kb_tuner_state& state = mode_.state();
  if (state.measurement_id == last_measurement_) return false;
  last_measurement_ = state.measurement_id;
  if (state.can_hear_note == 0) {
    reading_ = Reading{};
    return true;
  }
  reading_.pitch_hz = state.measured_hz;
  reading_.cents = state.tuning_error_cents;
  reading_.confidence = mode_.clarity();
  reading_.note_index = state.target_midi;
  return true;
}

}  // namespace kitbag
