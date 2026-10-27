#include "click_classifier.h"

#include <algorithm>
#include <cmath>
#include <cstddef>

#include "metronome/metronome_internal.h"
#include "soak_stats.h"

namespace click_soak {

namespace {

using kitbag::metronome_detail::kMsPerSecond;
constexpr double kP95 = 0.95;
constexpr double kP99 = 0.99;

struct Match {
  size_t beat = 0;
  double time_sec = 0.0;
  double offset_sec = 0.0;
};

void Note(std::vector<Event>* events, double time_sec, double value_ms) {
  if (events->size() >= kMaxListedEvents) return;
  events->push_back({time_sec, value_ms});
}

double TrackedOffset(const std::vector<Match>& matches) {
  const size_t first =
      matches.size() > kTrackClicks ? matches.size() - kTrackClicks : 0;
  std::vector<double> recent;
  for (size_t i = first; i < matches.size(); ++i) {
    recent.push_back(matches[i].offset_sec);
  }
  return UpperMedian(recent);
}

struct Slot {
  size_t begin = 0;
  size_t end = 0;
  size_t beat = 0;
  double beat_sec = 0.0;
  double centre_sec = 0.0;
};

void ResolveSlot(
    const std::vector<double>& onsets,
    const Slot& slot,
    Report* report,
    std::vector<Match>* matches
) {
  if (slot.begin == slot.end) {
    ++report->dropped;
    Note(&report->dropped_at, slot.centre_sec, 0.0);
    return;
  }
  size_t chosen = slot.begin;
  for (size_t i = slot.begin + 1; i < slot.end; ++i) {
    const double distance = std::fabs(onsets[i] - slot.centre_sec);
    if (distance < std::fabs(onsets[chosen] - slot.centre_sec)) chosen = i;
  }
  for (size_t i = slot.begin; i < slot.end; ++i) {
    if (i == chosen) continue;
    ++report->doubled;
    const double gap_ms = (onsets[i] - onsets[chosen]) * kMsPerSecond;
    Note(&report->doubled_at, onsets[i], gap_ms);
  }
  const double time = onsets[chosen];
  matches->push_back({slot.beat, time, time - slot.beat_sec});
}

size_t SkipBefore(const std::vector<double>& onsets, double edge) {
  size_t next = 0;
  while (next < onsets.size() && onsets[next] < edge) ++next;
  return next;
}

// The recording ends where the tracked slot does, not the nominal one: drift
// within budget moves the last real click by whole beats over hours.
std::vector<Match> AssignSlots(
    const std::vector<double>& onsets,
    const std::vector<double>& grid,
    double duration_sec,
    Report* report
) {
  std::vector<Match> matches;
  size_t next =
      SkipBefore(onsets, grid[0] - kSlotHalfWidth * BeatSpacing(grid, 0));
  report->outside_grid = next;
  for (size_t beat = 0; beat < grid.size(); ++beat) {
    const double centre = grid[beat] + TrackedOffset(matches);
    const double edge = centre + kSlotHalfWidth * BeatSpacing(grid, beat);
    if (edge > duration_sec) break;
    size_t end = next;
    while (end < onsets.size() && onsets[end] < edge) ++end;
    const Slot slot = {next, end, beat, grid[beat], centre};
    ResolveSlot(onsets, slot, report, &matches);
    ++report->beats_expected;
    next = end;
  }
  report->outside_grid += onsets.size() - next;
  return matches;
}

// Centred and odd: a true median, so linear clock drift leaves no bias and one
// displaced click is outvoted. It shrinks at the ends; the interval gate covers them.
double LocalReference(const std::vector<Match>& matches, size_t index) {
  const size_t after = matches.size() - 1 - index;
  const size_t half = std::min({kJitterNeighbours, index, after});
  std::vector<double> offsets;
  for (size_t i = index - half; i <= index + half; ++i) {
    offsets.push_back(matches[i].offset_sec);
  }
  return UpperMedian(offsets);
}

void JudgeJitter(const std::vector<Match>& matches, Report* report) {
  for (size_t i = 0; i < matches.size(); ++i) {
    const double deviation_ms =
        (matches[i].offset_sec - LocalReference(matches, i)) * kMsPerSecond;
    report->deviation_max_abs_ms =
        std::max(report->deviation_max_abs_ms, std::fabs(deviation_ms));
    if (std::fabs(deviation_ms) > kJitterToleranceMs) {
      ++report->jittered;
      Note(&report->jittered_at, matches[i].time_sec, deviation_ms);
    }
  }
}

struct IntervalErrors {
  std::vector<double> errors_ms;
  double played_sec = 0.0;
  double expected_sec = 0.0;
};

IntervalErrors CollectIntervals(
    const std::vector<Match>& matches,
    const std::vector<double>& grid,
    Report* report
) {
  IntervalErrors collected;
  for (size_t i = 1; i < matches.size(); ++i) {
    if (matches[i].beat != matches[i - 1].beat + 1) continue;
    const double played = matches[i].time_sec - matches[i - 1].time_sec;
    const double expected = grid[matches[i].beat] - grid[matches[i - 1].beat];
    const double error_ms = (played - expected) * kMsPerSecond;
    collected.errors_ms.push_back(error_ms);
    collected.played_sec += played;
    collected.expected_sec += expected;
    if (std::fabs(error_ms) > kJitterToleranceMs) {
      ++report->intervals_off;
      Note(&report->intervals_off_at, matches[i].time_sec, error_ms);
    }
  }
  return collected;
}

void MeasureIntervals(
    const std::vector<Match>& matches,
    const std::vector<double>& grid,
    Report* report
) {
  const IntervalErrors collected = CollectIntervals(matches, grid, report);
  const std::vector<double>& errors = collected.errors_ms;
  report->intervals = errors.size();
  if (errors.empty()) return;
  std::vector<double> magnitudes;
  double sum = 0.0;
  for (const double error : errors) {
    sum += error;
    magnitudes.push_back(std::fabs(error));
  }
  report->error_mean_ms = sum / static_cast<double>(errors.size());
  report->error_p50_ms = Quantile(magnitudes, 0.5);
  report->error_p95_ms = Quantile(magnitudes, kP95);
  report->error_p99_ms = Quantile(magnitudes, kP99);
  report->error_max_abs_ms =
      *std::max_element(magnitudes.begin(), magnitudes.end());
  report->tempo_error_ppm =
      (collected.played_sec / collected.expected_sec - 1.0) * kPpm;
}

void MeasureWorstWindow(const std::vector<Match>& matches, Report* report) {
  const size_t window = std::min(kOffsetWindowClicks, matches.size());
  double sum_abs = 0.0;
  for (size_t i = 0; i < matches.size(); ++i) {
    sum_abs += std::fabs(matches[i].offset_sec);
    if (i >= window) sum_abs -= std::fabs(matches[i - window].offset_sec);
    if (i + 1 < window) continue;
    const double mean_ms = sum_abs / static_cast<double>(window) * kMsPerSecond;
    if (mean_ms > report->offset_worst_window_ms) {
      report->offset_worst_window_ms = mean_ms;
      report->offset_worst_window_sec = matches[i + 1 - window].time_sec;
    }
  }
}

void MeasureOffsets(const std::vector<Match>& matches, Report* report) {
  if (matches.empty()) return;
  double sum = 0.0;
  double sum_abs = 0.0;
  for (const Match& match : matches) {
    const double offset_ms = match.offset_sec * kMsPerSecond;
    sum += offset_ms;
    sum_abs += std::fabs(offset_ms);
    report->offset_max_abs_ms =
        std::max(report->offset_max_abs_ms, std::fabs(offset_ms));
  }
  const auto count = static_cast<double>(matches.size());
  report->offset_mean_ms = sum / count;
  report->offset_mean_abs_ms = sum_abs / count;
  MeasureWorstWindow(matches, report);
}

}  // namespace

Report ClassifyClicks(
    const std::vector<double>& onsets_sec,
    const std::vector<double>& grid_sec,
    double duration_sec
) {
  Report report;
  report.onsets_detected = onsets_sec.size();
  const std::vector<Match> matches =
      AssignSlots(onsets_sec, grid_sec, duration_sec, &report);
  report.clicks_analysed = matches.size();
  JudgeJitter(matches, &report);
  MeasureIntervals(matches, grid_sec, &report);
  MeasureOffsets(matches, &report);
  return report;
}

}  // namespace click_soak
