#include "metronome_test_audio.h"
#include "metronome_test_rig_model.h"

namespace metronome_test {
namespace {

using kitbag::RigClick;

constexpr int64_t kRigTicks = 24;
constexpr RigCase kRigCases[] = {{100, 1}, {100, 3}, {97, 1}, {133, 4}};
// Neither tempo is exact in binary. 38.4 * 3 rounds low, so tick 1's whole
// quotient computes a hair above 25000; 123.4's tick 617 is whole too.
constexpr RigCase kFractionalCases[] = {
    {.bpm_numerator = 384, .subdivision = 3, .bpm_denominator = 10},
    {.bpm_numerator = 1234, .subdivision = 1, .bpm_denominator = 10},
};
constexpr int64_t kFractionalTicks = 640;
constexpr RigCase kHundred = {100, 1};
constexpr RigCase kHundredTriplets = {100, 3};
constexpr int64_t kLateBlock = 391 * int64_t{kBlockFrames};
constexpr int64_t kStopBlock = 200 * int64_t{kBlockFrames};
constexpr int64_t kTicksBeforeStop = 5;
constexpr int64_t kTicksChecked = 3;

template <typename OnBlock>
std::vector<RigTick>
CollectTicks(RigClick& rig, int64_t total_frames, OnBlock on_block) {
  std::vector<RigTick> ticks;
  for (int64_t block = 0; block < total_frames; block += kBlockFrames) {
    on_block(block);
    rig.BeginBlock(static_cast<uint64_t>(block), kSampleRate, false);
    for (int64_t frame = block; frame < block + kBlockFrames; ++frame) {
      const int slot = rig.ConsumeTickAt(static_cast<uint64_t>(frame));
      if (slot != RigClick::kNoTick) ticks.push_back({frame, slot});
    }
  }
  return ticks;
}

bool MatchesModel(
    const std::vector<RigTick>& ticks,
    const RigCase& rig,
    int64_t start,
    int64_t first_tick,
    int64_t count
) {
  if (static_cast<int64_t>(ticks.size()) < count) {
    std::fprintf(
        stderr,
        "  %zu ticks, want %lld\n",
        ticks.size(),
        static_cast<long long>(count)
    );
    return false;
  }
  for (int64_t i = 0; i < count; ++i) {
    const int64_t tick = first_tick + i;
    const RigTick want = ModelTick(start, rig, tick);
    const RigTick got = ticks[static_cast<size_t>(i)];
    if (got.frame == want.frame && got.slot == want.slot) continue;
    std::fprintf(
        stderr,
        "  tick %lld: frame %lld slot %d, want frame %lld slot %d\n",
        static_cast<long long>(tick),
        static_cast<long long>(got.frame),
        got.slot,
        static_cast<long long>(want.frame),
        want.slot
    );
    return false;
  }
  return true;
}

void ExpectModelTicks(const RigCase& rig, int64_t count) {
  RigClick click;
  click.Start(rig.bpm(), rig.subdivision, kRigStart);
  const auto ticks =
      CollectTicks(click, ModelTick(kRigStart, rig, count).frame, [](int64_t) {
      });
  CheckCase(
      MatchesModel(ticks, rig, kRigStart, 0, count),
      RigLabel("ticks on start + ceil(k * period)", rig),
      "every tick on its model frame and slot"
  );
}

void TestTicksFollowTheFrameRule() {
  for (const RigCase& rig : kRigCases) ExpectModelTicks(rig, kRigTicks);
  for (const RigCase& rig : kFractionalCases) {
    ExpectModelTicks(rig, kFractionalTicks);
  }
}

void ExpectLateStart(
    int64_t start_frame,
    int64_t first_tick,
    const char* what
) {
  RigClick click;
  const auto ticks = CollectTicks(
      click,
      ModelTick(start_frame, kHundred, first_tick + kTicksChecked).frame,
      OnceAtFrame(kLateBlock, [&click, start_frame](int64_t) {
        click.Start(kHundred.bpm(), kHundred.subdivision, start_frame);
      })
  );
  CheckCase(
      MatchesModel(ticks, kHundred, start_frame, first_tick, kTicksChecked),
      RigLabel(what, kHundred),
      "a past start_frame keeps its schedule from the draining block on"
  );
}

void TestPastStartKeepsSchedule() {
  ExpectLateStart(kRigStart, 4, "past start skips ticks before the block");
  const int64_t tick_on_block =
      kLateBlock - 3 * ModelTick(0, kHundred, 1).frame;
  ExpectLateStart(tick_on_block, 3, "past start sounds a tick on the block");
}

void TestStopFromNextBlock() {
  RigClick click;
  click.Start(kHundredTriplets.bpm(), kHundredTriplets.subdivision, kRigStart);
  const auto ticks = CollectTicks(
      click,
      2 * kStopBlock,
      OnceAtFrame(kStopBlock, [&click](int64_t) { click.Stop(); })
  );
  CheckCase(
      ticks.size() == kTicksBeforeStop &&
          MatchesModel(ticks, kHundredTriplets, kRigStart, 0, kTicksBeforeStop),
      RigLabel("stop silences from the next block", kHundredTriplets),
      "ticks before the stop block only"
  );
  Check(!click.is_active(), "rig click: stop clears is_active");
}

std::vector<int64_t> TriggerFrames(const std::vector<float>& left) {
  std::vector<int64_t> triggers;
  for (size_t i = 1; i < left.size(); ++i) {
    if (left[i - 1] == 0.0f && left[i] != 0.0f) {
      triggers.push_back(static_cast<int64_t>(i) - 1);
    }
  }
  return triggers;
}

void TestAudibleOnsetsOnModel() {
  constexpr RigCase kOdd = {97, 1};
  kitbag::Metronome metronome;
  metronome.rig_click().Start(kOdd.bpm(), kOdd.subdivision, kRigStart);
  const auto triggers = TriggerFrames(
      RenderLeft(metronome, ModelTick(kRigStart, kOdd, kRigTicks).frame)
  );
  std::vector<RigTick> ticks;
  for (const int64_t frame : triggers) ticks.push_back({frame, 0});
  CheckCase(
      MatchesModel(ticks, kOdd, kRigStart, 0, kRigTicks),
      RigLabel("rendered clicks start on the model frames", kOdd),
      "first non-zero sample one frame after each tick frame"
  );
  Check(
      metronome.rig_click().is_active(),
      "rig click: is_active while running"
  );
}

}  // namespace

void RunRigClickScheduleTests() {
  TestTicksFollowTheFrameRule();
  TestPastStartKeepsSchedule();
  TestStopFromNextBlock();
  TestAudibleOnsetsOnModel();
}

}  // namespace metronome_test
