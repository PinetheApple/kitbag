#ifndef KITBAG_PITCH_ANALYZER_H
#define KITBAG_PITCH_ANALYZER_H

#include <cstdint>
#include <optional>

#include <q/pitch/pitch_detector.hpp>

namespace kitbag {

// Nearest chromatic note to `frequency_hz`: MIDI number and offset in cents.
int32_t NoteIndexForFrequency(double frequency_hz, double a4_hz);
double CentsOffsetForFrequency(double frequency_hz, double a4_hz);

// Offline pitch analysis: cycfi/q bitstream-autocorrelation detection plus
// the PLAN §3 smoothing chain (median on Hz, EMA on cents, settle <150ms).
// One instance per analysis thread; feed mono samples, poll reading().
// Not thread-safe by design — the Tuner wraps it behind atomics.
class PitchAnalyzer {
 public:
  static constexpr double kDefaultA4Hz = 440.0;
  static constexpr double kMinA4Hz = 415.0;
  static constexpr double kMaxA4Hz = 466.0;
  // Chromatic default band: A1 to above E6. The bitstream autocorrelation
  // misdetects some tones once the band spans much past 4.5 octaves, so
  // notes below A1 are reached through instrument preset bands instead.
  static constexpr double kChromaticLowHz = 55.0;
  static constexpr double kChromaticHighHz = 1400.0;

  struct Reading {
    double pitch_hz = 0.0;    // smoothed; 0 = no pitch detected
    double cents = 0.0;       // offset from nearest chromatic note
    double confidence = 0.0;  // autocorrelation periodicity [0, 1]
    int32_t note_index = -1;  // MIDI number of nearest note, -1 = none
  };

  PitchAnalyzer(double sample_rate, double low_hz, double high_hz);

  void SetA4(double a4_hz);
  // Constrains detection to [low_hz, high_hz] — the per-string band that
  // kills octave errors. Rebuilds the detector (allocates; not RT-safe).
  void SetBand(double low_hz, double high_hz);

  // Feeds one mono sample. Returns true when reading() was refreshed.
  bool Process(float sample);

  const Reading& reading() const { return reading_; }
  double band_low_hz() const { return band_low_hz_; }
  double band_high_hz() const { return band_high_hz_; }

 private:
  // ~30ms window at guitar E2 comes from the detector itself (its window is
  // two periods of the band's lowest frequency); we publish on a fixed
  // 60Hz cadence per PLAN §3 (50% overlap → 50-60Hz updates).
  static constexpr int kUpdatesPerSecond = 60;
  static constexpr int kMedianLength = 3;
  // EMA on cents: ~90% settled within 4 updates (~66ms) of a stable median.
  static constexpr double kCentsEmaAlpha = 0.4;
  // Peak-follower gate: below this input level we report "no pitch".
  static constexpr double kGateLevel = 0.003;  // ≈ -50 dBFS
  static constexpr double kGateReleasePerSecond = 20.0;
  static constexpr float kDetectorHysteresisDb = -40.0f;

  void RebuildDetector();
  void PublishFrequency(double frequency_hz);
  void PublishSilence();
  double MedianHz(double frequency_hz);

  double sample_rate_;
  double a4_hz_ = kDefaultA4Hz;
  double band_low_hz_;
  double band_high_hz_;

  std::optional<cycfi::q::pitch_detector> detector_;
  int samples_until_update_ = 0;
  int samples_per_update_;

  double envelope_ = 0.0;
  double envelope_decay_;

  double median_window_[kMedianLength] = {};
  int median_filled_ = 0;
  double ema_cents_ = 0.0;
  bool ema_seeded_ = false;

  Reading reading_;
};

}  // namespace kitbag

#endif  // KITBAG_PITCH_ANALYZER_H
