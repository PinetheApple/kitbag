#ifndef KITBAG_TUNER_TUNING_MODE_H
#define KITBAG_TUNER_TUNING_MODE_H

// String-aware tuning (docs/tuner-functional-spec.md §4) over one mono stream.
// Single-threaded: Tuner hands it to exactly one thread at a time.
#include "kitbag_api.h"

#include <array>
#include <cstdint>
#include <vector>

#include "tuner/note_smoother.h"
#include "tuner/pitch_detector.h"
#include "tuner/wrong_string_hint.h"

namespace kitbag {

class TuningMode {
 public:
  static constexpr int32_t kMaxStrings = KB_TUNER_MAX_STRINGS;
  static constexpr int32_t kMaxMidi = 127;
  static constexpr double kMinA4Hz = 415.0;
  static constexpr double kMaxA4Hz = 466.0;
  static constexpr double kDefaultA4Hz = 440.0;
  // Chromatic mode's default band: B0 a quarter-tone flat up to C7.
  static constexpr double kChromaticLowHz = 30.0;
  static constexpr double kChromaticHighHz = 2100.0;

  static bool
  ValidTuning(int32_t instrument, const int32_t* string_midis, int32_t count);

  // Callers validate first; these apply and clear the held note.
  void
  SetTuning(int32_t instrument, const int32_t* string_midis, int32_t count);
  void SetTargetString(int32_t string_index);
  void SetChromatic();
  // Chromatic mode's range; string modes derive theirs from the tuning.
  void SetChromaticBand(double low_hz, double high_hz);
  void SetA4(double a4_hz);
  void ResetNotePresence(double pause_ms);

  // Allocates. Restarts analysis with every input-derived value cleared; the
  // measurement id keeps counting and a pending pause survives.
  void Init(uint32_t sample_rate);
  void Process(const float* samples, uint32_t frame_count);

  const kb_tuner_state& state() const {
    return state_;
  }
  // NSDF clarity of the pitch the held note last took, 0 with no note.
  double clarity() const {
    return clarity_;
  }
  static kb_tuner_state RestState();

 private:
  enum class Mode { kAuto, kManual, kChromatic };

  void DeriveHopCounts();
  void OnHop();
  void AdvancePause();
  int PauseHops(double pause_ms) const;
  double UnwrapFrame();
  void RecordLevel(double rms);
  void AnalysisRange(double* low_hz, double* high_hz) const;
  void OnPitch(double midi, double rms);
  bool SameNote(int32_t string_a, int32_t string_b) const;
  void OnAutoPitch(double midi);
  void LoseConfidence(int32_t named_string);
  void Track(double midi, int32_t string);
  void NoteMissed();
  void ClearNote();
  int32_t NearestString(double midi) const;
  void UpdateManualHint(double midi, double rms);
  void Publish();
  void PublishNote();
  void PublishHint();

  // Configuration.
  std::array<int32_t, kMaxStrings> string_midis_{};
  int32_t string_count_ = 0;
  int32_t instrument_ = KB_TUNER_INSTRUMENT_GUITAR;
  Mode mode_ = Mode::kAuto;
  int32_t target_string_ = KB_TUNER_NO_STRING;
  double a4_hz_ = kDefaultA4Hz;
  double chromatic_low_hz_ = kChromaticLowHz;
  double chromatic_high_hz_ = kChromaticHighHz;

  // Framing; every hop count below is derived from the rate in Init.
  PitchDetector detector_;
  std::vector<float> history_;
  std::vector<float> frame_;
  int frame_size_ = 0;
  int hop_size_ = 0;
  int write_ = 0;
  int filled_ = 0;
  int until_hop_ = 0;
  double hop_seconds_ = 0.0;
  int ratio_hops_ = 0;
  int no_sound_hops_ = 0;
  std::vector<double> levels_;
  int level_next_ = 0;

  // The held note.
  bool note_present_ = false;
  int32_t current_string_ = KB_TUNER_NO_STRING;
  int32_t target_midi_ = KB_TUNER_NO_NOTE;
  int confidence_ = 0;  // P10, every mode; P27 drains it after the tone
  int missed_hops_ = 0;
  int in_window_hops_ = 0;
  double clarity_ = 0.0;
  double hop_clarity_ = 0.0;
  NoteSmoother smoother_;
  WrongStringHint manual_hint_;
  int32_t auto_hint_ = KB_TUNER_NO_STRING;

  int quiet_hops_ = 0;
  int pause_hops_ = 0;
  double pending_pause_ms_ = 0.0;  // requested, its first hop not yet reached
  kb_tuner_state state_ = RestState();
};

}  // namespace kitbag

#endif  // KITBAG_TUNER_TUNING_MODE_H
