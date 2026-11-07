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

bool LandedOnNextBlock(kitbag::Mixer* mixer) {
  RenderPaced(mixer, 1);
  return mixer->song_clock().opens_on_jump;
}

bool LandsAgainWithin(kitbag::Mixer* mixer, int blocks) {
  bool landed = false;
  for (int b = 0; b < blocks; ++b) landed |= LandedOnNextBlock(mixer);
  return landed;
}

void CheckSeekLandsOnce(kitbag::Mixer* mixer, const char* once) {
  mixer->Seek(kSeekTo, kZeroClock, false);
  const bool first = LandedOnNextBlock(mixer);
  Check(first && !LandedOnNextBlock(mixer), once);
}

void TestBypass() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.Play();
  Check(!LandsAgainWithin(&mixer, kSettleBlocks), "landed: plain play is none");
  CheckSeekLandsOnce(&mixer, "landed: a bypass seek marks one block");
}

void TestStretch() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(kSpeed, kZeroClock, false);
  Check(!LandsAgainWithin(&mixer, kWatchBlocks), "landed: a hand-over is none");
  Check(mixer.stretch_engaged(), "landed: the hand-over engaged");
  mixer.SetRate(kSlower, kZeroClock, false);
  Check(
      !LandsAgainWithin(&mixer, kWatchBlocks),
      "landed: a rate change is none"
  );
  mixer.SetLoop(kLoopStart, kLoopEnd, kZeroClock, false);
  Check(
      !LandsAgainWithin(&mixer, kSettleBlocks),
      "landed: a kept loop is none"
  );
  CheckSeekLandsOnce(&mixer, "landed: a stretched seek marks one block");
}

bool ContinuesOnNextBlock(kitbag::Mixer* mixer) {
  RenderPaced(mixer, 1);
  return mixer->song_clock().opens_on_jump && mixer->song_clock().continues_run;
}

void TestSeekIsNoContinuation() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.SetRate(kSpeed, kZeroClock, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.Seek(kSeekTo, kZeroClock, false);
  Check(!ContinuesOnNextBlock(&mixer), "landed: a seek is no continuation");
}

// A callback that never answers leaves the last-resort jump at the head.
void TestLastResortJumpContinues() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(kSpeed, kZeroClock, true);
  Check(
      ContinuesOnNextBlock(&mixer),
      "landed: the last-resort jump continues the run"
  );
}

void TestSeekWhilePausedWaitsForPlay() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.SetRate(kSpeed, kZeroClock, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.Pause();
  RenderPaced(&mixer, 1);
  mixer.Seek(kSeekTo, kZeroClock, false);
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
  TestSeekIsNoContinuation();
  TestLastResortJumpContinues();
}

}  // namespace mixer_test
