#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_GRID_OFFSET_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_GRID_OFFSET_H

#include <cstddef>
#include <cstdint>
#include <span>
#include <string>
#include <vector>

namespace metronome_test {

enum class ShiftRule : uint8_t { kDrop, kReseek, kWait };

constexpr int kOffsetGridBeats = 60;
constexpr int64_t kNoOffsetChange = -1;
constexpr int64_t kFrameTolerance = 1;
constexpr double kFastIntervalSec = 0.15;
constexpr int kNoSubdivision = 1;
constexpr int kSixteenths = 4;

struct OffsetChange {
  const char* name;
  double interval_sec;
  double from_ms;
  double to_ms;
  int64_t change_frame;
  ShiftRule rule;
  int subdivision;
  int switch_beat = kOffsetGridBeats;
  double interval_after_switch_sec = 0.0;
};

enum class StepKind : uint8_t {
  kOffset,
  kRepublish,
  kFollowOff,
  kRestart,
  kStopThenAnchor
};

struct OffsetStep {
  int64_t frame;
  StepKind kind;
  double offset_ms;
  uint64_t anchor_frame;
};

struct OffsetRender {
  std::vector<int64_t> onsets;
  double min_bar_phase;
};

std::vector<int64_t> ExpectedOnsets(const OffsetChange& change, ShiftRule rule);
std::vector<int64_t> ExpectedStepOnsets(
    const OffsetChange& change,
    std::span<const OffsetStep> steps,
    bool follow
);
bool MatchesOneForOne(
    const std::vector<int64_t>& onsets,
    const std::vector<int64_t>& expected,
    std::string* detail
);
size_t CrossedTicks(const OffsetChange& change);
double BeatSec(const OffsetChange& change, int beat);
OffsetRender RenderOffsetChange(const OffsetChange& change, bool follow);
OffsetRender RenderOffsetSteps(
    const OffsetChange& change,
    std::span<const OffsetStep> steps,
    bool follow
);
void RunGridOffsetStepTests();

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_GRID_OFFSET_H
