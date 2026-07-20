#ifndef KITBAG_TUNER_PITCH_ANALYZER_H
#define KITBAG_TUNER_PITCH_ANALYZER_H

#include <cstdint>
#include <optional>
#include <q/pitch/pitch_detector.hpp>

#include "tuner/note_lock.h"

namespace kitbag {

int32_t NoteIndexForFrequency(double frequency_hz, double a4_hz);
double CentsOffsetForFrequency(double frequency_hz, double a4_hz);

class PitchAnalyzer {
 public:
  static constexpr double kDefaultA4Hz = 440.0;
  static constexpr double kMinA4Hz = 415.0;
  static constexpr double kMaxA4Hz = 466.0;
  static constexpr double kChromaticLowHz = 55.0;
  static constexpr double kChromaticHighHz = 1400.0;

  struct Reading {
    double pitch_hz = 0.0;
    double cents = 0.0;
    double confidence = 0.0;
    int32_t note_index = -1;
  };

  PitchAnalyzer(double sample_rate, double low_hz, double high_hz);

  void SetA4(double a4_hz);
  void SetBand(double low_hz, double high_hz);

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
  static constexpr int kUpdatesPerSecond = 60;
  static constexpr int kMedianLength = 5;
  static constexpr double kCentsEmaAlpha = 0.25;
  static constexpr double kDetectorHysteresisDb = -40.0;

  // Adaptive noise gate: asymmetric RMS envelope
  static constexpr double kRmsAttack = 0.02;
  static constexpr double kRmsRelease = 0.0005;
  static constexpr double kNoiseFloorAttack = 0.00001;
  static constexpr double kNoiseFloorRelease = 0.01;
  static constexpr double kGateThresholdDb = 12.0;
  static constexpr double kHardFloor = 0.000003;

  void RebuildDetector();
  void UpdateNoiseGate(double sample_sq);
  // Snapshots reading_ when the lock starts riding, so a dropout freezes on
  // what was last published rather than on whatever the detector emits next.
  void ApplyOutcome(NoteLock::Outcome outcome, const NoteLock::Update& update);
  void PublishReading(const NoteLock::Update& update);
  void PublishFrequency(double frequency_hz);
  void HandleNoSignal();
  void PublishSilence();
  double MedianHz(double frequency_hz);

  double sample_rate_;
  double a4_hz_ = kDefaultA4Hz;
  double band_low_hz_;
  double band_high_hz_;

  std::optional<cycfi::q::pitch_detector> detector_;
  int samples_until_update_ = 0;
  int samples_per_update_;

  double rms_envelope_ = 0.0;
  double noise_floor_ = 0.0;
  bool gate_open_ = false;

  double median_window_[kMedianLength] = {};
  int median_filled_ = 0;
  double ema_cents_ = 0.0;
  bool ema_seeded_ = false;

  NoteLock lock_;
  NoteLock::State previous_lock_state_ = NoteLock::State::kNone;
  Reading last_locked_reading_;

  Reading reading_;
};

}  // namespace kitbag

#endif
