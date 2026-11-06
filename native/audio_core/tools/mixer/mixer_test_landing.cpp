#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr float kSlower = 0.5f;
constexpr int64_t kToneFrames = int64_t{6} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate + 7;
constexpr int64_t kLoopStart = kSampleRate / 2;
constexpr int64_t kLoopEnd = int64_t{5} * kSampleRate;
constexpr int kSettleBlocks = 40;
// Long enough to pass a hand-over's lead and a pending rate's record spacing.
constexpr int kWatchBlocks = 120;

void LoadTone(kitbag::Mixer* mixer) {
  LoadPcm(
      mixer,
      0,
      ToneFixture({.frames = kToneFrames, .steady_hz = kBurstHz})
  );
}

bool LandedOnNextBlock(kitbag::Mixer* mixer) {
  RenderPaced(mixer, 1);
  return mixer->song_clock().landed;
}

bool LandsAgainWithin(kitbag::Mixer* mixer, int blocks) {
  bool landed = false;
  for (int b = 0; b < blocks; ++b) landed |= LandedOnNextBlock(mixer);
  return landed;
}

void CheckSeekLandsOnce(kitbag::Mixer* mixer, const char* once) {
  mixer->Seek(kSeekTo, 0, false);
  const bool first = LandedOnNextBlock(mixer);
  Check(first && !LandedOnNextBlock(mixer), once);
}

void TestBypass() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer);
  mixer.Play();
  Check(!LandsAgainWithin(&mixer, kSettleBlocks), "landed: plain play is none");
  CheckSeekLandsOnce(&mixer, "landed: a bypass seek marks one block");
}

void TestStretch() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(kSpeed, 0, false);
  Check(!LandsAgainWithin(&mixer, kWatchBlocks), "landed: a hand-over is none");
  Check(mixer.stretch_engaged(), "landed: the hand-over engaged");
  mixer.SetRate(kSlower, 0, false);
  Check(
      !LandsAgainWithin(&mixer, kWatchBlocks),
      "landed: a rate change is none"
  );
  mixer.SetLoop(kLoopStart, kLoopEnd, 0, false);
  Check(
      !LandsAgainWithin(&mixer, kSettleBlocks),
      "landed: a kept loop is none"
  );
  CheckSeekLandsOnce(&mixer, "landed: a stretched seek marks one block");
}

void TestSeekWhilePausedWaitsForPlay() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer);
  mixer.SetRate(kSpeed, 0, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.Pause();
  RenderPaced(&mixer, 1);
  mixer.Seek(kSeekTo, 0, false);
  RenderPaced(&mixer, kSettleBlocks);
  mixer.Play();
  Check(
      LandedOnNextBlock(&mixer),
      "landed: a seek while paused marks the first block played"
  );
}

}  // namespace

void RunLandingTests() {
  TestBypass();
  TestStretch();
  TestSeekWhilePausedWaitsForPlay();
}

}  // namespace mixer_test
