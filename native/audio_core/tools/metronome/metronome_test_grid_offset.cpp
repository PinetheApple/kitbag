#include "metronome_test_grid_offset.h"

#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kMsPerSecond;

constexpr double kFullClampMs = kitbag::Metronome::kMaxLatencyOffsetMs;
constexpr double kSmallOffsetMs = 20.0;
constexpr double kNearFromMs = 100.0;
constexpr double kThresholdMarginMs = 5.0;
constexpr double kFastIntervalSec = 0.15;
constexpr double kSlowIntervalSec = 0.37;
constexpr int kNoSubdivision = 1;
constexpr int kSixteenths = 4;
constexpr int64_t kChangeFrame = int64_t{750} * kBlockFrames;
// 32 frames after beat 23 sounds at +20 ms, 928 before it sounds at 0 ms.
constexpr int64_t kFastSmallChangeFrame = int64_t{737} * kBlockFrames;
// 64 frames after beat 10 sounds at +20 ms, 896 before it sounds at 0 ms.
constexpr int64_t kSlowSmallChangeFrame = int64_t{784} * kBlockFrames;
// 101 ms after downbeat 24 sounds at +100 ms, so a short move back passes it.
constexpr int64_t kDownbeatChangeFrame = int64_t{769} * kBlockFrames;
// At -300 ms, 5 ms past the third sixteenth; 50 ms after the last tick at +300,
// so an onset at the change is not hidden by the detector's hold.
constexpr int64_t kSubSeekChangeFrame = int64_t{758} * kBlockFrames;
constexpr int64_t kFrameTolerance = 1;
constexpr size_t kIssueCrossedBeats = 4;

constexpr double JustUnderIntervalMs(double interval_sec) {
  return kNearFromMs - (interval_sec * kMsPerSecond - kThresholdMarginMs);
}

constexpr double JustOverIntervalMs(double interval_sec) {
  return kNearFromMs - (interval_sec * kMsPerSecond + kThresholdMarginMs);
}

constexpr OffsetChange kIssueCase{
    "400 bpm -300 -> +300",
    kFastIntervalSec,
    -kFullClampMs,
    kFullClampMs,
    kChangeFrame,
    ShiftRule::kDrop,
    kNoSubdivision
};

constexpr OffsetChange kFastJustUnder{
    "400 bpm back just under a beat",
    kFastIntervalSec,
    kNearFromMs,
    JustUnderIntervalMs(kFastIntervalSec),
    kDownbeatChangeFrame,
    ShiftRule::kWait,
    kNoSubdivision
};

constexpr OffsetChange kChanges[] = {
    kIssueCase,
    {"400 bpm +300 -> -300",
     kFastIntervalSec,
     kFullClampMs,
     -kFullClampMs,
     kChangeFrame,
     ShiftRule::kReseek,
     kNoSubdivision},
    {"400 bpm 0 -> +20",
     kFastIntervalSec,
     0.0,
     kSmallOffsetMs,
     kFastSmallChangeFrame,
     ShiftRule::kDrop,
     kNoSubdivision},
    {"400 bpm +20 -> 0",
     kFastIntervalSec,
     kSmallOffsetMs,
     0.0,
     kFastSmallChangeFrame,
     ShiftRule::kWait,
     kNoSubdivision},
    kFastJustUnder,
    {"400 bpm back just over a beat",
     kFastIntervalSec,
     kNearFromMs,
     JustOverIntervalMs(kFastIntervalSec),
     kDownbeatChangeFrame,
     ShiftRule::kReseek,
     kNoSubdivision},
    {"0.37 s -300 -> +300",
     kSlowIntervalSec,
     -kFullClampMs,
     kFullClampMs,
     kChangeFrame,
     ShiftRule::kDrop,
     kNoSubdivision},
    {"0.37 s +300 -> -300",
     kSlowIntervalSec,
     kFullClampMs,
     -kFullClampMs,
     kChangeFrame,
     ShiftRule::kReseek,
     kNoSubdivision},
    {"0.37 s 0 -> +20",
     kSlowIntervalSec,
     0.0,
     kSmallOffsetMs,
     kSlowSmallChangeFrame,
     ShiftRule::kDrop,
     kNoSubdivision},
    {"0.37 s +20 -> 0",
     kSlowIntervalSec,
     kSmallOffsetMs,
     0.0,
     kSlowSmallChangeFrame,
     ShiftRule::kWait,
     kNoSubdivision},
    {"0.37 s back just under a beat",
     kSlowIntervalSec,
     kNearFromMs,
     JustUnderIntervalMs(kSlowIntervalSec),
     kChangeFrame,
     ShiftRule::kWait,
     kNoSubdivision},
    {"0.37 s back just over a beat",
     kSlowIntervalSec,
     kNearFromMs,
     JustOverIntervalMs(kSlowIntervalSec),
     kChangeFrame,
     ShiftRule::kReseek,
     kNoSubdivision},
    {"0.37 s x4 -300 -> +300",
     kSlowIntervalSec,
     -kFullClampMs,
     kFullClampMs,
     kChangeFrame,
     ShiftRule::kDrop,
     kSixteenths},
    {"0.37 s x4 +300 -> -300",
     kSlowIntervalSec,
     kFullClampMs,
     -kFullClampMs,
     kSubSeekChangeFrame,
     ShiftRule::kReseek,
     kSixteenths},
};

bool MatchesOneForOne(
    const std::vector<int64_t>& onsets,
    const std::vector<int64_t>& expected,
    std::string* detail
) {
  for (size_t i = 0; i < std::min(onsets.size(), expected.size()); ++i) {
    if (std::llabs(onsets[i] - expected[i]) > kFrameTolerance) {
      *detail = "onset " + std::to_string(i) + " at " +
                std::to_string(onsets[i]) + ", expected " +
                std::to_string(expected[i]);
      return false;
    }
  }
  *detail = std::to_string(onsets.size()) + " onsets, expected " +
            std::to_string(expected.size());
  return onsets.size() == expected.size();
}

int64_t LargestGap(const std::vector<int64_t>& onsets) {
  int64_t gap = 0;
  for (size_t i = 1; i < onsets.size(); ++i) {
    gap = std::max(gap, onsets[i] - onsets[i - 1]);
  }
  return gap;
}

int64_t GapBound(const OffsetChange& change) {
  const double waited_sec = change.rule == ShiftRule::kWait
                                ? (change.from_ms - change.to_ms) / kMsPerSecond
                                : 0.0;
  return std::llround((2.0 * change.interval_sec + waited_sec) * kSampleRate);
}

std::vector<int64_t>
OnsetsBefore(const std::vector<int64_t>& onsets, int64_t frame) {
  std::vector<int64_t> before;
  for (const int64_t onset : onsets) {
    if (onset < frame) before.push_back(onset);
  }
  return before;
}

bool FixtureSeparatesRules(const OffsetChange& change) {
  if (change.rule == ShiftRule::kDrop) return CrossedTicks(change) > 0;
  return ExpectedOnsets(change, ShiftRule::kReseek) !=
         ExpectedOnsets(change, ShiftRule::kWait);
}

void CheckOffsetChange(const OffsetChange& change) {
  const std::string label = std::string("grid offset ") + change.name;
  const auto onsets =
      RenderOffsetChange(change, change.change_frame, false).onsets;
  std::string detail;
  const bool on_time =
      MatchesOneForOne(onsets, ExpectedOnsets(change, change.rule), &detail);
  CheckCase(
      on_time,
      label + ": every tick on its rule's frame",
      detail.c_str()
  );
  const int64_t gap = LargestGap(onsets);
  CheckCase(
      gap <= GapBound(change) + kFrameTolerance,
      label + ": no silence beyond the rule's span",
      std::to_string(gap).c_str()
  );
  const auto baseline =
      RenderOffsetChange(change, kNoOffsetChange, false).onsets;
  Check(
      OnsetsBefore(onsets, change.change_frame) ==
          OnsetsBefore(baseline, change.change_frame),
      (label + ": clicks before the change are untouched").c_str()
  );
  Check(
      FixtureSeparatesRules(change),
      (label + ": fixture tells the rules apart").c_str()
  );
}

void TestIssueCaseCrossesFourBeats() {
  Check(
      CrossedTicks(kIssueCase) == kIssueCrossedBeats,
      "grid offset model: -300 -> +300 at 400 bpm crosses four beats"
  );
}

void TestFollowIgnoresAMidRunChange() {
  Check(
      RenderOffsetChange(kIssueCase, kChangeFrame, true).onsets ==
          RenderOffsetChange(kIssueCase, kNoOffsetChange, true).onsets,
      "grid offset follow: a mid-run change moves no click"
  );
}

void TestBarPhaseHoldsThroughAWait() {
  const double min_phase =
      RenderOffsetChange(kFastJustUnder, kDownbeatChangeFrame, false)
          .min_bar_phase;
  CheckCase(
      min_phase >= 0.0,
      "grid offset wait: bar_phase never negative",
      std::to_string(min_phase).c_str()
  );
}

}  // namespace

void RunGridOffsetChangeTests() {
  for (const OffsetChange& change : kChanges) CheckOffsetChange(change);
  TestIssueCaseCrossesFourBeats();
  TestFollowIgnoresAMidRunChange();
  TestBarPhaseHoldsThroughAWait();
}

}  // namespace metronome_test
