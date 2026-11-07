#include <vector>

#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr int64_t kToneFrames = int64_t{6} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate + 7;
constexpr int kSettleBlocks = 40;

void TestBankFreedBeforeSnapshotSounds() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.SetRate(kSpeed, kZeroClock, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  bool fired = false;
  mixer.set_snapshot_hook([&mixer, &fired] {
    if (fired) return;
    fired = true;
    mixer.Seek(kSeekTo, kZeroClock, true);
  });
  CheckSoundsAtOnce(
      &mixer,
      "race: a bank freed before the snapshot still sounds that block"
  );
  Check(fired, "race: the re-prime ran inside the block");
  mixer.set_snapshot_hook(nullptr);
}

// engine_running with no callback: the hand-over verdict never comes.
void TestStalledVerdictJumps() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer, kToneFrames);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(kSpeed, kZeroClock, true);
  std::vector<float> left = RenderPaced(&mixer, 1);
  Check(
      mixer.stretch_engaged(),
      "verdict: a stalled callback gets a primed jump, engaged at once"
  );
  Check(
      mixer.missed_handovers() == 0,
      "verdict: a stall is neither a miss nor retried"
  );
  const std::vector<float> rest = RenderPaced(&mixer, kSettleBlocks);
  left.insert(left.end(), rest.begin(), rest.end());
  CheckNoQuietWindow(left, 0, "verdict: playback runs on after the jump");
}

}  // namespace

void RunRaceTests() {
  TestBankFreedBeforeSnapshotSounds();
  TestStalledVerdictJumps();
}

}  // namespace mixer_test
