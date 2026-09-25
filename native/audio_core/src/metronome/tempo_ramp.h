#ifndef KITBAG_METRONOME_TEMPO_RAMP_H
#define KITBAG_METRONOME_TEMPO_RAMP_H

#include <cstdint>

namespace kitbag {

enum class RampUnit : uint8_t { kBars = 0, kSeconds = 1, kMinutes = 2 };

// Time units measure progress in rendered frames, so the engine clock drives it.
class TempoRamp {
 public:
  static constexpr int kMaxBars = 64;
  static constexpr double kMinSeconds = 1.0;
  static constexpr double kMaxSeconds = 3600.0;
  static constexpr double kMinBpm = 20.0;
  static constexpr double kMaxBpm = 400.0;

  bool Configure(
      double start_bpm,
      double end_bpm,
      double duration,
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
  void Advance() {
    ++cycle_frames_;
  }
  double StepAtDownbeat(int64_t bar, uint32_t sample_rate);

 private:
  double Progress(int64_t bar, uint32_t sample_rate) const;

  bool enabled_ = false;
  bool loop_ = false;
  bool in_seconds_ = false;
  double start_bpm_ = 0.0;
  double end_bpm_ = 0.0;
  double length_ = 1.0;
  int64_t cycle_bar_ = 0;
  int64_t cycle_frames_ = 0;
  bool at_end_ = false;
};

}  // namespace kitbag

#endif  // KITBAG_METRONOME_TEMPO_RAMP_H
