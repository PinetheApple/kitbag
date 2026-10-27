#ifndef KITBAG_TOOLS_SOAK_CLICK_SOAK_TYPES_H
#define KITBAG_TOOLS_SOAK_CLICK_SOAK_TYPES_H

#include <cstddef>
#include <vector>

namespace click_soak {

// Gates every interval and every click. The engine clicks sample-accurately,
// so 1 ms is 48 samples of slack over a detector error of one sample.
constexpr double kJitterToleranceMs = 1.0;
// Recorder and phone DAC crystals typically sit within +-100 ppm each, so up
// to 200 ppm apart; 0.1 bpm off at 120 bpm is 833 ppm.
constexpr double kMaxTempoErrorPpm = 300.0;
constexpr double kPpm = 1e6;
// SPEC 6.5 sets no number. One 256-frame block at 48 kHz is 5.3 ms, so a
// stretch of clicks a whole block off the grid fails.
constexpr double kMaxWindowOffsetMs = 5.0;
// Two 4/4 bars: enough clicks to average out mic detection noise, few
// enough that one late section of a song cannot hide in the whole-track mean.
constexpr size_t kOffsetWindowClicks = 8;
// A click belongs to its nearest beat, so a slot spans half a beat each side:
// an empty slot is a dropped click, a second click in one slot a doubled one.
constexpr double kSlotHalfWidth = 0.5;
// Unaccented clicks render quieter than accents; half the median click peak
// still catches them.
constexpr double kDetectFraction = 0.5;
constexpr double kRearmFraction = 0.5;
constexpr double kOnsetFraction = 0.1;
constexpr double kOnsetLookbackMs = 5.0;
constexpr double kNoisePercentile = 0.1;
constexpr double kNoiseMargin = 2.0;
constexpr double kNoiseBlockMs = 5.0;
// Well above the half-period of the lowest preset tone (300 Hz, 1.7 ms), so
// the envelope cannot dip back under the re-arm level inside one click.
constexpr double kEnvelopeReleaseMs = 5.0;
// Medians, so one displaced or extra click cannot move the reference it is
// judged against, while recorder/DAC clock drift (ppm) is still followed.
constexpr size_t kTrackClicks = 9;
constexpr size_t kJitterNeighbours = 4;
// A grid spacing, and so an expected interval, needs two beats; an interval
// needs two clicks.
constexpr size_t kMinGridBeats = 2;
constexpr size_t kMinClicks = 2;
constexpr size_t kMaxListedEvents = 10;

enum class ExitCode : int {
  kPass = 0,
  kThresholdsFailed = 1,
  kUsage = 2,
  kUnreadableAudio = 3,
  kInvalidMetadata = 4,
  kNoClicks = 5,
};

struct Event {
  double time_sec = 0.0;
  double value_ms = 0.0;
};

struct Report {
  size_t onsets_detected = 0;
  size_t outside_grid = 0;
  size_t beats_expected = 0;
  size_t clicks_analysed = 0;
  size_t intervals = 0;
  size_t dropped = 0;
  size_t doubled = 0;
  size_t jittered = 0;
  size_t intervals_off = 0;
  double error_mean_ms = 0.0;
  double error_p50_ms = 0.0;
  double error_p95_ms = 0.0;
  double error_p99_ms = 0.0;
  double error_max_abs_ms = 0.0;
  double tempo_error_ppm = 0.0;
  double deviation_max_abs_ms = 0.0;
  double offset_mean_ms = 0.0;
  double offset_mean_abs_ms = 0.0;
  double offset_max_abs_ms = 0.0;
  double offset_worst_window_ms = 0.0;
  double offset_worst_window_sec = 0.0;
  bool offset_gated = true;
  std::vector<Event> dropped_at;
  std::vector<Event> doubled_at;
  std::vector<Event> jittered_at;
  std::vector<Event> intervals_off_at;
};

}  // namespace click_soak

#endif  // KITBAG_TOOLS_SOAK_CLICK_SOAK_TYPES_H
