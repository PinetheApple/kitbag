#include <algorithm>
#include <memory>
#include <string>
#include <vector>

#include "click_take.h"
#include "metronome/metronome.h"
#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr float kSpeed = 0.75f;
constexpr double kFirstBeatSec = 0.0517;
constexpr double kBeatSec = 0.2371;
constexpr int kBeatCount = 40;
constexpr int64_t kStemFrames = int64_t{12} * kSampleRate;
constexpr int kStemCount = 5;
constexpr int kFifthKeyTrack = 4;
// Unaccented, as is the beat before it, so one voice's energy compares.
constexpr size_t kFlipBeat = 6;
constexpr int64_t kLeadFrames = 240;
// Past the lead at any rate here: the callback plays on while the prime runs.
constexpr int kBlocksPastLead = 4;
constexpr int kBlocksAfter = 120;
constexpr int64_t kVoiceWindowFrames = 4320;
constexpr int64_t kClickRingDownFrames = 5760;
// One voice reads 1.0, two stacked well over 1.9.
constexpr double kMaxSingleVoiceRatio = 1.25;

int64_t BeatFrame(size_t beat) {
  const double seconds = kFirstBeatSec + kBeatSec * static_cast<double>(beat);
  return static_cast<int64_t>(seconds * kSampleRate);
}

struct Rig {
  kitbag::Mixer mixer{kSampleRate};
  kitbag::Metronome metronome;
  std::vector<float> left;

  Rig() {
    for (int t = 0; t < kStemCount; ++t) {
      LoadPcm(&mixer, t, ToneFixture({.frames = kStemFrames}));
    }
    auto grid = std::make_unique<kitbag::BeatGrid>();
    for (int b = 0; b < kBeatCount; ++b) {
      grid->beat_times_sec.push_back(kFirstBeatSec + kBeatSec * b);
    }
    metronome.SetTimeSignature(4, 4);
    metronome.SetGrid(std::move(grid), 0, true);
    metronome.SetFollowMixer(true);
    metronome.Start();
    mixer.SetRate(kSpeed, 0, false);
    for (int t = 1; t < kFifthKeyTrack; ++t) {
      mixer.SetTrackPitch(t, static_cast<float>(t), 0, false);
    }
    mixer.Play();
  }
  void Blocks(int count) {
    std::vector<float> out(static_cast<size_t>(kBlock) * 2);
    for (int b = 0; b < count; ++b) {
      WaitForReadAhead(mixer);
      mixer.Process(out.data(), kBlock);
      metronome
          .Render(out.data(), kBlock, kSampleRate, 2, 0, &mixer.song_clock());
      AppendLeft(&left, out, kBlock);
    }
  }
  void BlocksUntilHead(int64_t frame) {
    while (static_cast<int64_t>(mixer.position()) < frame) Blocks(1);
  }
  void FlipConfig() {
    mixer.SetTrackPitch(
        kFifthKeyTrack,
        static_cast<float>(kFifthKeyTrack),
        0,
        false
    );
  }
  void FlipConfigWhilePlayingOn() {
    mixer.set_prime_publish_hook([this] { Blocks(kBlocksPastLead); });
    FlipConfig();
    mixer.set_prime_publish_hook({});
  }
};

double Energy(const std::vector<float>& left, int64_t from) {
  double energy = 0.0;
  const int64_t size = static_cast<int64_t>(left.size());
  for (int64_t k = from; k < std::min(from + kVoiceWindowFrames, size); ++k) {
    const auto sample = static_cast<double>(left[k]);
    energy += sample * sample;
  }
  return energy;
}

void CheckOneVoice(
    const std::vector<float>& left,
    const std::vector<int64_t>& clicks,
    size_t click,
    const char* label
) {
  const bool have = clicks.size() > click && click > 0;
  const double ratio =
      have ? Energy(left, clicks[click]) / Energy(left, clicks[kFlipBeat - 1])
           : 0.0;
  Check(have && ratio <= kMaxSingleVoiceRatio, label);
  if (!have || ratio > kMaxSingleVoiceRatio) {
    std::fprintf(
        stderr,
        "  %zu clicks, energy ratio %.2f\n",
        clicks.size(),
        ratio
    );
  }
}

void TestRePrimeDoesNotRefireItsBeat() {
  Rig rig;
  rig.BlocksUntilHead(BeatFrame(kFlipBeat) - kLeadFrames);
  rig.FlipConfigWhilePlayingOn();
  Check(
      rig.mixer.key_buses_vendor_default(),
      "re-prime: the fifth key flips the config"
  );
  rig.Blocks(kBlocksAfter);
  const std::vector<int64_t> clicks = click_take::DetectClicks(rig.left);
  CheckOneVoice(
      rig.left,
      clicks,
      kFlipBeat,
      "re-prime: a beat it rewinds over sounds one voice"
  );
  Check(
      clicks.size() > kFlipBeat + 1,
      "re-prime: the beats after it still sound"
  );
}

size_t ClicksFrom(const Rig& rig, int64_t frame) {
  size_t count = 0;
  for (const int64_t click : click_take::DetectClicks(rig.left)) {
    count += click >= frame ? 1 : 0;
  }
  return count;
}

void TestUserSeekStillReplays() {
  Rig rig;
  rig.BlocksUntilHead(BeatFrame(kFlipBeat) - kLeadFrames);
  rig.FlipConfigWhilePlayingOn();
  rig.BlocksUntilHead(BeatFrame(kFlipBeat + 1) + kClickRingDownFrames);
  const auto from = static_cast<int64_t>(rig.left.size());
  rig.mixer.Seek(
      static_cast<uint64_t>(BeatFrame(kFlipBeat) - kLeadFrames),
      0,
      false
  );
  rig.Blocks(kBlocksPastLead);
  Check(
      ClicksFrom(rig, from) == 1,
      "re-prime: a user seek still replays its beat"
  );
}

void CheckSeekThenRePrimeWhilePaused(bool adopt_seek, const char* label) {
  Rig rig;
  rig.BlocksUntilHead(BeatFrame(kFlipBeat) + kLeadFrames);
  rig.mixer.Pause();
  rig.Blocks(1);
  rig.mixer.Seek(
      static_cast<uint64_t>(BeatFrame(kFlipBeat) - kLeadFrames),
      0,
      false
  );
  if (adopt_seek) rig.Blocks(1);
  rig.FlipConfig();
  rig.Blocks(1);
  const auto from = static_cast<int64_t>(rig.left.size());
  rig.mixer.Play();
  rig.Blocks(kBlocksPastLead);
  Check(ClicksFrom(rig, from) == 1, label);
}

}  // namespace

void RunRePrimeTests() {
  TestRePrimeDoesNotRefireItsBeat();
  TestUserSeekStillReplays();
  CheckSeekThenRePrimeWhilePaused(
      true,
      "re-prime: on a landed paused seek, the seek's beat still replays"
  );
  CheckSeekThenRePrimeWhilePaused(
      false,
      "re-prime: over a pending paused seek, the seek's beat still replays"
  );
}

}  // namespace mixer_test
