#ifndef KITBAG_TUNER_PITCH_ANALYZER_H
#define KITBAG_TUNER_PITCH_ANALYZER_H

// A per-sample chromatic reading over one band, for tuner_verify's reference
// tones: a TuningMode in chromatic mode. Not linked into kitbag_core.
#include <cstdint>

#include "tuner/tuning_mode.h"

namespace kitbag {

int32_t NoteIndexForFrequency(double frequency_hz, double a4_hz);
double CentsOffsetForFrequency(double frequency_hz, double a4_hz);

class PitchAnalyzer {
 public:
  static constexpr double kChromaticLowHz = TuningMode::kChromaticLowHz;
  static constexpr double kChromaticHighHz = TuningMode::kChromaticHighHz;

  struct Reading {
    double pitch_hz = 0.0;
    double cents = 0.0;
    double confidence = 0.0;
    int32_t note_index = -1;
  };

  PitchAnalyzer(double sample_rate, double low_hz, double high_hz);

  void SetA4(double a4_hz);
  // Ignored unless 0 < low_hz < high_hz. Drops the held note.
  void SetBand(double low_hz, double high_hz);

  // True when this sample completed an analysis hop and reading() changed.
  bool Process(float sample);

  const Reading& reading() const {
    return reading_;
  }
  double band_low_hz() const {
    return band_low_hz_;
  }
  double band_high_hz() const {
    return band_high_hz_;
  }

 private:
  TuningMode mode_;
  double band_low_hz_;
  double band_high_hz_;
  uint32_t last_measurement_ = 0;
  Reading reading_;
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_PITCH_ANALYZER_H
