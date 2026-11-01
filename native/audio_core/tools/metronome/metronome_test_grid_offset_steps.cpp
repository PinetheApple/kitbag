#include <span>
#include <string>

#include "metronome_test_audio.h"
#include "metronome_test_grid_offset.h"

namespace metronome_test {
namespace {

constexpr double kWaitFromMs = 140.0;
constexpr double kForwardToMs = 100.0;
constexpr double kFirstBackMs = -100.0;
constexpr double kNetBackMs = -200.0;
constexpr double kFullClampMs = kitbag::Metronome::kMaxLatencyOffsetMs;
constexpr uint64_t kSameAnchorFrame = 0;
constexpr double kMovedAnchorSec = 0.3;
constexpr auto kMovedAnchorFrame =
    static_cast<uint64_t>(kMovedAnchorSec * kSampleRate);
// 160 frames after beat 23 sounds at +140 ms; the second step lands 30 ms
// later, with the +100 ms position still behind beat 23.
constexpr int64_t kBeatWaitFrame = int64_t{715} * kBlockFrames;
constexpr int64_t kBeatStepFrame = int64_t{720} * kBlockFrames;
// 144 frames after the second sixteenth of beat 23 sounds at +140 ms.
constexpr int64_t kSubWaitFrame = int64_t{729} * kBlockFrames;
constexpr int64_t kSubStepFrame = int64_t{734} * kBlockFrames;
constexpr int64_t kMidRunFrame = int64_t{750} * kBlockFrames;

constexpr OffsetChange kFastGrid{
    "400 bpm",
    kFastIntervalSec,
    kWaitFromMs,
    0.0,
    kNoOffsetChange,
    ShiftRule::kWait,
    kNoSubdivision
};

constexpr OffsetChange kFastSixteenths{
    "400 bpm x4",
    kFastIntervalSec,
    kWaitFromMs,
    0.0,
    kNoOffsetChange,
    ShiftRule::kWait,
    kSixteenths
};

constexpr OffsetChange kFollowGrid{
    "400 bpm follow",
    kFastIntervalSec,
    -kFullClampMs,
    0.0,
    kNoOffsetChange,
    ShiftRule::kReseek,
    kNoSubdivision
};

constexpr OffsetStep kBeatWaitThenForward[] = {
    {kBeatWaitFrame, StepKind::kOffset, 0.0, kSameAnchorFrame},
    {kBeatStepFrame, StepKind::kOffset, kForwardToMs, kSameAnchorFrame},
};

constexpr OffsetStep kSubWaitThenForward[] = {
    {kSubWaitFrame, StepKind::kOffset, 0.0, kSameAnchorFrame},
    {kSubStepFrame, StepKind::kOffset, kForwardToMs, kSameAnchorFrame},
};

constexpr OffsetStep kWaitThenRepublish[] = {
    {kBeatWaitFrame, StepKind::kOffset, 0.0, kSameAnchorFrame},
    {kBeatStepFrame, StepKind::kRepublish, 0.0, kSameAnchorFrame},
};

constexpr OffsetStep kWaitThenMovedAnchor[] = {
    {kBeatWaitFrame, StepKind::kOffset, 0.0, kSameAnchorFrame},
    {kBeatStepFrame, StepKind::kRepublish, 0.0, kMovedAnchorFrame},
};

constexpr OffsetStep kWaitThenRestart[] = {
    {kBeatWaitFrame, StepKind::kOffset, 0.0, kSameAnchorFrame},
    {kBeatStepFrame, StepKind::kRestart, 0.0, kSameAnchorFrame},
};

constexpr OffsetStep kWaitThenAnchorFromStopped[] = {
    {kBeatWaitFrame, StepKind::kOffset, 0.0, kSameAnchorFrame},
    {kBeatStepFrame, StepKind::kStopThenAnchor, 0.0, kSameAnchorFrame},
};

constexpr OffsetStep kFollowThenEngineClock[] = {
    {kMidRunFrame, StepKind::kFollowOff, 0.0, kSameAnchorFrame},
};

void CheckSteps(
    const char* name,
    const OffsetChange& change,
    std::span<const OffsetStep> steps,
    bool follow
) {
  std::string detail;
  const bool matches = MatchesOneForOne(
      RenderOffsetSteps(change, steps, follow).onsets,
      ExpectedStepOnsets(change, steps, follow),
      &detail
  );
  CheckCase(
      matches,
      std::string("grid offset steps ") + name +
          ": no tick twice on one timeline, each on its frame",
      detail.c_str()
  );
}

void TestCommandsInOneBlockActAsTheirSum() {
  const OffsetChange net_back{
      "0 -> -100 -> -200 in one block",
      kFastIntervalSec,
      0.0,
      kNetBackMs,
      kMidRunFrame,
      ShiftRule::kReseek,
      kNoSubdivision
  };
  const OffsetStep two_steps_back[] = {
      {kMidRunFrame, StepKind::kOffset, kFirstBackMs, kSameAnchorFrame},
      {kMidRunFrame, StepKind::kOffset, kNetBackMs, kSameAnchorFrame},
  };
  std::string detail;
  const bool matches = MatchesOneForOne(
      RenderOffsetSteps(net_back, two_steps_back, false).onsets,
      ExpectedOnsets(net_back, ShiftRule::kReseek),
      &detail
  );
  CheckCase(
      matches,
      "grid offset steps: two moves back in one block replay as one 200 ms",
      detail.c_str()
  );
}

}  // namespace

void RunGridOffsetStepTests() {
  CheckSteps("back then forward", kFastGrid, kBeatWaitThenForward, false);
  CheckSteps(
      "back then forward x4",
      kFastSixteenths,
      kSubWaitThenForward,
      false
  );
  CheckSteps("republish in a wait", kFastGrid, kWaitThenRepublish, false);
  CheckSteps("moved anchor", kFastGrid, kWaitThenMovedAnchor, false);
  CheckSteps("restart in a wait", kFastGrid, kWaitThenRestart, false);
  CheckSteps(
      "anchor from stopped in a wait",
      kFastGrid,
      kWaitThenAnchorFromStopped,
      false
  );
  CheckSteps("follow off", kFollowGrid, kFollowThenEngineClock, true);
  TestCommandsInOneBlockActAsTheirSum();
}

}  // namespace metronome_test
