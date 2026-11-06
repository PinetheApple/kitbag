#include <vector>

#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr int64_t kToneFrames = int64_t{6} * kSampleRate;
constexpr int64_t kSeekTo = kSampleRate + 7;
constexpr int kSettleBlocks = 40;

void LoadTone(kitbag::Mixer* mixer) {
  LoadPcm(
      mixer,
      0,
      ToneFixture({.frames = kToneFrames, .steady_hz = kBurstHz})
  );
}

void CheckLoud(
    const std::vector<float>& block,
    int64_t from,
    const char* label
) {
  const float peak = Loudest(block, from, static_cast<int64_t>(block.size()));
  Check(peak > kOnsetThreshold, label);
  if (peak <= kOnsetThreshold) {
    std::fprintf(stderr, "  peak %.3f\n", static_cast<double>(peak));
  }
}

// The re-prime lands after the callback read the plan and before it loaded
// the buses, so the bank it adopted is already freed.
void TestBankFreedBeforeSnapshotSounds() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer);
  mixer.SetRate(kSpeed, 0, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  bool fired = false;
  mixer.set_snapshot_hook([&mixer, &fired] {
    if (fired) return;
    fired = true;
    mixer.Seek(kSeekTo, 0, true);
  });
  const std::vector<float> block = RenderPaced(&mixer, 1);
  Check(fired, "race: the re-prime ran inside the block");
  CheckLoud(
      block,
      mixer.crossfade_frames(),
      "race: a bank freed before the snapshot still sounds that block"
  );
  mixer.set_snapshot_hook(nullptr);
}

// engine_running with no callback: the hand-over verdict never comes.
void TestStalledVerdictJumps() {
  kitbag::Mixer mixer(kSampleRate);
  LoadTone(&mixer);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(kSpeed, 0, true);
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
