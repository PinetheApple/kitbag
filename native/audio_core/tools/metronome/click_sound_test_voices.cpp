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

namespace click_sound_test {

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
  voices.Publish(0, f, 0, false);
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
  voices.Publish(0, f, 0, false);
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
          0,
          false
      ),
      "voice: publish refuses a slot out of range"
  );
  Check(
      !voices.Publish(0, {}, 0, false),
      "voice: publish refuses an empty sound"
  );
}

// Gain 2^k per hit: dropping the new hit, stealing the newest and stealing
// the oldest each leave a different sum.
void TestOldestVoiceIsStolen() {
  SampleVoices voices;
  voices.Publish(1, std::vector<float>(kBlock * 2, 1.0F), 0, false);
  voices.BeginBlock();
  float last = 0.0F;
  float gain = 1.0F;
  float all = 0.0F;
  for (int hit = 0; hit <= SampleVoices::kMaxVoices; ++hit) {
    voices.Trigger(1, gain);
    all += gain;
    gain *= 2.0F;
    last = voices.Render();
  }
  Check(last == all - 1.0F, "voice: a hit past the pool replaces the oldest");
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
  voices.Publish(0, Distinct(kShortFrames), 0, false);
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

void TestReplacedSoundRetiresOffTheAudioThread() {
  SampleVoices voices;
  voices.Publish(0, Distinct(kitbag::kCustomSoundRate), 0, true);
  std::vector<float> after(kBlock);
  RenderBlock(voices, after, {0, 1.0F});
  voices.Publish(0, Distinct(kShortFrames), kBlock, true);
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
  Check(
      after[0] == 0.0F,
      "retire: a voice of the replaced sound stops at the next block"
  );
  voices.Collect(kBlock + kGrace + 1);
  Check(
      voices.retired_size() == 0 && LiveHeapBytes() < live,
      "retire: the app thread frees it once the grace window passes"
  );
}

void TestClearWhileStoppedFreesAtOnce() {
  SampleVoices voices;
  voices.Publish(0, Distinct(kShortFrames), 0, false);
  voices.Clear(0, 0, false);
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
