#ifndef KITBAG_METRONOME_TEMPO_RAMP_H
#define KITBAG_METRONOME_TEMPO_RAMP_H

#include <cstdint>

namespace kitbag {

enum class RampUnit : uint8_t { kBars = 0, kSeconds = 1, kMinutes = 2 };
enum class RampState : uint8_t { kOff = 0, kStepping = 1, kAtTarget = 2 };

struct RampStatus {
  RampState state = RampState::kOff;
  double next_bpm = 0.0;
  double remaining = 0.0;
  double progress = 0.0;
};

// A stepped ramp (SPEC §5.3, D15): the tempo holds for one interval, then
// moves by exactly one step toward the target, and stops on it. Time units
// measure in rendered frames, so the engine clock drives them.
class TempoRamp {
 public:
  static constexpr int kMinBars = 1;
  static constexpr int kMaxBars = 64;
  static constexpr double kMinSeconds = 1.0;
  static constexpr double kMaxSeconds = 3600.0;
  static constexpr double kMinStepBpm = 1.0;

  bool Configure(
      double start_bpm,
      double target_bpm,
      double step_bpm,
      double interval,
      int32_t unit,
      bool loop
  );
  void Disable() {
    enabled_ = false;
  }
  bool enabled() const {
    return enabled_;
  }
  double start_bpm() const {
    return start_bpm_;
  }
  void Restart(int64_t bar);
  void AdvanceFrame() {
    ++cycle_frames_;
  }
  // Tempo for the beat starting now. A bar ramp moves only on a downbeat; a
  // time ramp moves on the first beat after its interval ends.
  double TempoAtBeat(bool downbeat, int64_t bar, uint32_t sample_rate);
  // `bar` and `bar_phase` locate the click; bar < 0 means no downbeat yet.
  RampStatus Status(int64_t bar, double bar_phase, uint32_t sample_rate) const;

 private:
  static double ClampInterval(double interval, RampUnit unit);
  int64_t IntervalsElapsed(int64_t bar, uint32_t sample_rate) const;
  int64_t StepsToTarget() const;
  double TempoAfter(int64_t intervals) const;
  void FillTiming(
      int64_t bar,
      double bar_phase,
      uint32_t sample_rate,
      RampStatus* status
  ) const;

  bool enabled_ = false;
  bool loop_ = false;
  bool in_seconds_ = false;
  RampUnit unit_ = RampUnit::kBars;
  double start_bpm_ = 0.0;
  double target_bpm_ = 0.0;
  double step_bpm_ = kMinStepBpm;
  double interval_ = 1.0;
  double current_bpm_ = 0.0;
  int64_t cycle_bar_ = 0;
  int64_t cycle_frames_ = 0;
  int64_t applied_intervals_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_TEMPO_RAMP_H
