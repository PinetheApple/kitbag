#include <algorithm>
#include <cmath>
#include <cstdint>
#include <utility>
#include <vector>

#include "click_sound_test_support.h"
#include "metronome/click_sound_prepare.h"
#include "metronome/click_voices.h"
#include "metronome/sample_voices.h"
#include "rt/rt_publisher.h"
#include "test_clock.h"
#include "zero_clock.h"

namespace click_sound_test {

using kitbag_test::ClockAt;
using kitbag_test::kZeroClock;

using kitbag::SampleVoices;
using kitbag_test::Check;

namespace {

constexpr uint32_t kBlock = 64;
constexpr size_t kShortFrames = 37;
constexpr uint32_t kFirstHit = 19;
constexpr uint32_t kSecondHit = 29;
constexpr uint32_t kLateHit = 50;
constexpr float kFirstGain = 0.61F;
constexpr float kSecondGain = 0.3F;
constexpr uint64_t kGrace =
    kitbag::RtPublisher<SampleVoices::Sample>::kReclaimGraceFrames;

std::vector<float> Distinct(size_t frames) {
  std::vector<float> samples(frames);
  for (size_t i = 0; i < frames; ++i) {
    samples[i] =
        0.013F * static_cast<float>(i + 1) * (i % 2 == 0 ? 1.0F : -1.0F);
  }
  return samples;
}

struct Hit {
  uint32_t frame;
  float gain;
};
constexpr Hit kNoHit{UINT32_MAX, 0.0F};

// Writes into a caller's buffer so the allocation checks see only the voices.
void RenderBlock(
    SampleVoices& voices,
    std::vector<float>& out,
    Hit a = kNoHit,
    Hit b = kNoHit
) {
  voices.BeginBlock();
  for (uint32_t i = 0; i < kBlock; ++i) {
    if (a.frame == i) voices.Trigger(0, a.gain);
    if (b.frame == i) voices.Trigger(0, b.gain);
    out[i] = voices.Render();
  }
}

float Expected(
    const std::vector<float>& f,
    int64_t at,
    uint32_t hit,
    float gain
) {
  const int64_t j = at - hit;
  return j >= 0 && j < static_cast<int64_t>(f.size()) ? f[j] * gain : 0.0F;
}

void TestHitsLandOnTheirFrame() {
  SampleVoices voices;
  const std::vector<float> f = Distinct(kShortFrames);
  voices.Publish(0, f, kZeroClock, false);
  std::vector<float> out(kBlock);
  RenderBlock(voices, out, {kFirstHit, kFirstGain}, {kSecondHit, kSecondGain});
  bool exact = true;
  for (uint32_t i = 0; i < kBlock; ++i) {
    const float want = 0.0F + Expected(f, i, kFirstHit, kFirstGain) +
                       Expected(f, i, kSecondHit, kSecondGain);
    exact = exact && out[i] == want;
  }
  Check(
      exact,
      "voice: hits start on their frame at their gain and overlapping hits sum"
  );
}

void TestHitSpansBlocks() {
  SampleVoices voices;
  const std::vector<float> f = Distinct(kShortFrames);
  voices.Publish(0, f, kZeroClock, false);
  std::vector<float> first(kBlock);
  std::vector<float> second(kBlock);
  RenderBlock(voices, first, {kLateHit, kFirstGain});
  RenderBlock(voices, second);
  bool spans = true;
  for (uint32_t i = 0; i < kBlock; ++i) {
    spans =
        spans && first[i] == Expected(f, i, kLateHit, kFirstGain) &&
        second[i] ==
            Expected(f, static_cast<int64_t>(kBlock) + i, kLateHit, kFirstGain);
  }
  Check(spans, "voice: a hit late in a block carries on into the next");
}

void TestEmptySlotFallsBack() {
  SampleVoices voices;
  voices.BeginBlock();
  Check(!voices.Trigger(0, 1.0F), "voice: an empty slot refuses the trigger");
  Check(
      !voices.Trigger(kitbag::kCustomSoundSlots, 1.0F),
      "voice: a slot out of range refuses the trigger"
  );
  Check(voices.Render() == 0.0F, "voice: a refused trigger sounds nothing");
  Check(
      !voices.Publish(
          kitbag::kCustomSoundSlots,
          Distinct(kShortFrames),
          kZeroClock,
          false
      ),
      "voice: publish refuses a slot out of range"
  );
  Check(
      !voices.Publish(0, {}, kZeroClock, false),
      "voice: publish refuses an empty sound"
  );
}

// Hit k lands on frame k at gain 2^k over a ramp, so a dropped hit, a wrong
// steal, a stolen voice keeping its cursor or a hard cut each sum differently.
void TestOldestVoiceIsStolen() {
  SampleVoices voices;
  std::vector<float> ramp(kBlock * 2);
  constexpr int kBelowFullScale = -8;
  for (size_t i = 0; i < ramp.size(); ++i) {
    ramp[i] = std::ldexp(static_cast<float>(i + 1), kBelowFullScale);
  }
  voices.Publish(1, ramp, kZeroClock, false);
  voices.BeginBlock();
  float last = 0.0F;
  for (int hit = 0; hit <= SampleVoices::kMaxVoices; ++hit) {
    voices.Trigger(1, std::ldexp(1.0F, hit));
    last = voices.Render();
  }
  float expected = ramp[SampleVoices::kMaxVoices - 1];
  for (int hit = 1; hit <= SampleVoices::kMaxVoices; ++hit) {
    expected += ramp[SampleVoices::kMaxVoices - hit] * std::ldexp(1.0F, hit);
  }
  Check(
      last == expected,
      "voice: a hit past the pool replaces the oldest, whose last output "
      "starts a fade instead of cutting"
  );
}

void TestBuiltInPeakIsClickSoundPeak() {
  constexpr double kBeepHz = 1760.0;
  constexpr double kBeepDecay = 30.0;
  constexpr int kPeakFrames = 64;
  constexpr float kPeakTolerance = 0.01F;
  kitbag::ClickVoices clicks;
  clicks.Trigger(kBeepHz, 1.0, kBeepDecay, kitbag::kCustomSoundRate);
  float peak = 0.0F;
  for (int i = 0; i < kPeakFrames; ++i) {
    peak = std::max(peak, std::fabs(clicks.Render()));
  }
  Check(
      std::fabs(peak - kitbag::kClickSoundPeak) < kPeakTolerance,
      "peak: a built-in hit at gain 1 peaks at kClickSoundPeak"
  );
}

void TestRenderAllocatesNothing() {
  SampleVoices voices;
  voices.Publish(0, Distinct(kShortFrames), kZeroClock, false);
  std::vector<float> out(kBlock);
  const size_t live = LiveHeapBytes();
  ResetHeapPeak();
  for (int block = 0; block < 3; ++block) {
    RenderBlock(voices, out, {kFirstHit, kFirstGain});
  }
  Check(
      HeapPeakGrowth() == 0 && LiveHeapBytes() == live,
      "rt: BeginBlock, Trigger and Render neither allocate nor free"
  );
}

// The fade starts from the last value played and never reads the old sound
// again, whose samples alternate in sign.
void CheckCutFade(SampleVoices& voices, std::vector<float>& out, float last) {
  constexpr uint32_t kFade = SampleVoices::kCutFadeFrames;
  constexpr uint32_t kFadeBlocks = kFade / kBlock + 1;
  std::vector<float> fade = out;
  for (uint32_t block = 1; block < kFadeBlocks; ++block) {
    RenderBlock(voices, out);
    fade.insert(fade.end(), out.begin(), out.end());
  }
  bool fades = true;
  for (uint32_t i = 0; i < fade.size(); ++i) {
    const float want =
        i < kFade ? last * static_cast<float>(kFade - i) / kFade : 0.0F;
    fades = fades && fade[i] == want;
  }
  Check(
      fades,
      "retire: a voice of the replaced sound stops reading it at the next "
      "block and fades from its last value to silence"
  );
}

void TestReplacedSoundRetiresOffTheAudioThread() {
  SampleVoices voices;
  voices.Publish(0, Distinct(kitbag::kCustomSoundRate), kZeroClock, true);
  std::vector<float> after(kBlock);
  RenderBlock(voices, after, {0, 1.0F});
  const float last = after[kBlock - 1];
  voices.Publish(0, Distinct(kShortFrames), ClockAt(kBlock), true);
  Check(
      voices.retired_size() == 1,
      "retire: a replaced sound is held, not freed, while the callback can run"
  );
  const size_t live = LiveHeapBytes();
  ResetHeapPeak();
  RenderBlock(voices, after);
  Check(
      LiveHeapBytes() == live && HeapPeakGrowth() == 0,
      "retire: the audio thread frees nothing when a sound is replaced"
  );
  CheckCutFade(voices, after, last);
  voices.Collect(kBlock + kGrace + 1);
  Check(
      voices.retired_size() == 0 && LiveHeapBytes() < live,
      "retire: the app thread frees it once the grace window passes"
  );
}

void TestClearWhileStoppedFreesAtOnce() {
  SampleVoices voices;
  voices.Publish(0, Distinct(kShortFrames), kZeroClock, false);
  voices.Clear(0, kZeroClock, false);
  Check(
      !voices.loaded(0) && voices.retired_size() == 0,
      "retire: clearing with no callback running frees at once"
  );
}

}  // namespace

void RunVoiceTests() {
  TestHitsLandOnTheirFrame();
  TestHitSpansBlocks();
  TestEmptySlotFallsBack();
  TestOldestVoiceIsStolen();
  TestBuiltInPeakIsClickSoundPeak();
  TestRenderAllocatesNothing();
  TestReplacedSoundRetiresOffTheAudioThread();
  TestClearWhileStoppedFreesAtOnce();
}

}  // namespace click_sound_test
