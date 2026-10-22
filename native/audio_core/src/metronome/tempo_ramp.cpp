#include "metronome/tempo_ramp.h"

#include <algorithm>
#include <cmath>

#include "metronome/metronome_internal.h"
#include "metronome/metronome_types.h"

namespace kitbag {

using metronome_detail::Clamp;
using metronome_detail::kSecondsPerMinute;

bool TempoRamp::Configure(
    double start_bpm,
    double target_bpm,
    double step_bpm,
    double interval,
    int32_t unit,
    bool loop
) {
  if (!std::isfinite(start_bpm) || !std::isfinite(target_bpm) ||
      !std::isfinite(step_bpm) || !std::isfinite(interval) || step_bpm == 0.0) {
    return false;
  }
  if (unit < 0 || unit > static_cast<int32_t>(RampUnit::kMinutes)) return false;
  switch (static_cast<RampUnit>(unit)) {
    case RampUnit::kBars:
      interval_ = Clamp(
          std::round(interval),
          static_cast<double>(kMinBars),
          static_cast<double>(kMaxBars)
      );
      break;
    case RampUnit::kSeconds:
      interval_ = Clamp(interval, kMinSeconds, kMaxSeconds);
      break;
    case RampUnit::kMinutes:
      interval_ = Clamp(interval * kSecondsPerMinute, kMinSeconds, kMaxSeconds);
      break;
  }
  in_seconds_ = static_cast<RampUnit>(unit) != RampUnit::kBars;
  start_bpm_ = Clamp(start_bpm, kMinBpm, kMaxBpm);
  target_bpm_ = Clamp(target_bpm, kMinBpm, kMaxBpm);
  // The direction comes from start and target; the step is only a size.
  step_bpm_ = Clamp(std::abs(step_bpm), kMinStepBpm, kMaxBpm - kMinBpm);
  current_bpm_ = start_bpm_;
  loop_ = loop;
  enabled_ = true;
  return true;
}

void TempoRamp::Restart(int64_t bar) {
  cycle_bar_ = bar;
  cycle_frames_ = 0;
  current_bpm_ = start_bpm_;
}

double
TempoRamp::TempoAtBeat(bool downbeat, int64_t bar, uint32_t sample_rate) {
  if (!in_seconds_ && !downbeat) return current_bpm_;
  const double span = std::abs(target_bpm_ - start_bpm_);
  const auto steps_to_target =
      static_cast<int64_t>(std::ceil(span / step_bpm_));
  int64_t elapsed = IntervalsElapsed(bar, sample_rate);
  // Looping holds the target for one interval, then starts over.
  if (loop_ && elapsed > steps_to_target) {
    Restart(bar);
    elapsed = 0;
  }
  const double moved = std::min(static_cast<double>(elapsed) * step_bpm_, span);
  current_bpm_ =
      target_bpm_ >= start_bpm_ ? start_bpm_ + moved : start_bpm_ - moved;
  return current_bpm_;
}

int64_t TempoRamp::IntervalsElapsed(int64_t bar, uint32_t sample_rate) const {
  if (in_seconds_) {
    return static_cast<int64_t>(
        static_cast<double>(cycle_frames_) / (interval_ * sample_rate)
    );
  }
  return static_cast<int64_t>(
      static_cast<double>(bar - cycle_bar_) / interval_
  );
}

}  // namespace kitbag
