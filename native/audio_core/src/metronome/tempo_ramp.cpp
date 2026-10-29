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
  unit_ = static_cast<RampUnit>(unit);
  interval_ = ClampInterval(interval, unit_);
  in_seconds_ = unit_ != RampUnit::kBars;
  start_bpm_ = Clamp(start_bpm, kMinBpm, kMaxBpm);
  target_bpm_ = Clamp(target_bpm, kMinBpm, kMaxBpm);
  // The direction comes from start and target; the step is only a size.
  step_bpm_ = Clamp(std::abs(step_bpm), kMinStepBpm, kMaxBpm - kMinBpm);
  current_bpm_ = start_bpm_;
  loop_ = loop;
  enabled_ = true;
  return true;
}

double TempoRamp::ClampInterval(double interval, RampUnit unit) {
  switch (unit) {
    case RampUnit::kBars:
      return Clamp(
          std::round(interval),
          static_cast<double>(kMinBars),
          static_cast<double>(kMaxBars)
      );
    case RampUnit::kSeconds:
      return Clamp(interval, kMinSeconds, kMaxSeconds);
    case RampUnit::kMinutes:
      return Clamp(interval * kSecondsPerMinute, kMinSeconds, kMaxSeconds);
  }
  return interval;
}

void TempoRamp::Restart(int64_t bar) {
  cycle_bar_ = bar;
  cycle_frames_ = 0;
  applied_intervals_ = 0;
  current_bpm_ = start_bpm_;
}

double
TempoRamp::TempoAtBeat(bool downbeat, int64_t bar, uint32_t sample_rate) {
  if (!in_seconds_ && !downbeat) return current_bpm_;
  int64_t elapsed = IntervalsElapsed(bar, sample_rate);
  // Looping holds the target for one interval, then starts over.
  if (loop_ && elapsed > StepsToTarget()) {
    Restart(bar);
    elapsed = 0;
  }
  applied_intervals_ = elapsed;
  current_bpm_ = TempoAfter(elapsed);
  return current_bpm_;
}

RampStatus
TempoRamp::Status(int64_t bar, double bar_phase, uint32_t sample_rate) const {
  RampStatus status;
  if (!enabled_) return status;
  const bool on_target = applied_intervals_ >= StepsToTarget();
  if (on_target && !loop_) {
    status.state = RampState::kAtTarget;
    status.progress = 1.0;
    return status;
  }
  status.state = RampState::kStepping;
  status.next_bpm = on_target ? start_bpm_ : TempoAfter(applied_intervals_ + 1);
  FillTiming(bar, bar_phase, sample_rate, &status);
  return status;
}

void TempoRamp::FillTiming(
    int64_t bar,
    double bar_phase,
    uint32_t sample_rate,
    RampStatus* status
) const {
  const double step_at =
      static_cast<double>(applied_intervals_ + 1) * interval_;
  double elapsed = 0.0;
  if (in_seconds_) {
    elapsed = static_cast<double>(cycle_frames_) / sample_rate;
    status->remaining = std::max(step_at - elapsed, 0.0);
    if (unit_ == RampUnit::kMinutes) status->remaining /= kSecondsPerMinute;
  } else {
    if (bar >= cycle_bar_) {
      elapsed = static_cast<double>(bar - cycle_bar_) + bar_phase;
    }
    status->remaining = step_at - std::floor(elapsed);
  }
  const double into_interval =
      elapsed - static_cast<double>(applied_intervals_) * interval_;
  status->progress = Clamp(into_interval / interval_, 0.0, 1.0);
}

int64_t TempoRamp::StepsToTarget() const {
  const double span = std::abs(target_bpm_ - start_bpm_);
  return static_cast<int64_t>(std::ceil(span / step_bpm_));
}

double TempoRamp::TempoAfter(int64_t intervals) const {
  const double span = std::abs(target_bpm_ - start_bpm_);
  const double moved =
      std::min(static_cast<double>(intervals) * step_bpm_, span);
  return target_bpm_ >= start_bpm_ ? start_bpm_ + moved : start_bpm_ - moved;
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
