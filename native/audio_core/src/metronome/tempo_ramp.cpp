#include "metronome/tempo_ramp.h"

#include <cmath>

#include "metronome/metronome_internal.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kSecondsPerMinute;

namespace {

double ClampSeconds(double seconds) {
  return Clamp(
      seconds,
      static_cast<double>(TempoRamp::kMinSeconds),
      static_cast<double>(TempoRamp::kMaxSeconds)
  );
}

}  // namespace

bool TempoRamp::Configure(
    double start_bpm,
    double end_bpm,
    double duration,
    int32_t unit,
    bool loop
) {
  if (!std::isfinite(start_bpm) || !std::isfinite(end_bpm) ||
      !std::isfinite(duration)) {
    return false;
  }
  if (unit < 0 || unit > static_cast<int32_t>(RampUnit::kMinutes)) return false;
  switch (static_cast<RampUnit>(unit)) {
    case RampUnit::kBars:
      length_ = Clamp(std::round(duration), 1.0, static_cast<double>(kMaxBars));
      break;
    case RampUnit::kSeconds:
      length_ = ClampSeconds(duration);
      break;
    case RampUnit::kMinutes:
      length_ = ClampSeconds(duration * kSecondsPerMinute);
      break;
  }
  in_seconds_ = static_cast<RampUnit>(unit) != RampUnit::kBars;
  start_bpm_ = Clamp(start_bpm, kMinBpm, kMaxBpm);
  end_bpm_ = Clamp(end_bpm, kMinBpm, kMaxBpm);
  loop_ = loop;
  enabled_ = true;
  return true;
}

void TempoRamp::Restart(int64_t bar) {
  cycle_bar_ = bar;
  cycle_frames_ = 0;
  at_end_ = false;
}

double TempoRamp::StepAtDownbeat(int64_t bar, uint32_t sample_rate) {
  if (at_end_ && loop_) Restart(bar);
  const double progress = Progress(bar, sample_rate);
  at_end_ = progress >= 1.0;
  return start_bpm_ + (end_bpm_ - start_bpm_) * Clamp(progress, 0.0, 1.0);
}

double TempoRamp::Progress(int64_t bar, uint32_t sample_rate) const {
  if (in_seconds_) {
    return static_cast<double>(cycle_frames_) / (length_ * sample_rate);
  }
  return static_cast<double>(bar - cycle_bar_) / length_;
}

}  // namespace kitbag
