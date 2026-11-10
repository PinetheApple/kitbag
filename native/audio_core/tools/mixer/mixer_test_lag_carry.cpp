#include <algorithm>
#include <memory>
#include <vector>

#include "click_take.h"
#include "metronome/grid_bars.h"
#include "metronome/metronome.h"
#include "mixer_test_stretch_support.h"

namespace mixer_test {
namespace {

constexpr int64_t kStemFrames = int64_t{6} * kSampleRate;
constexpr int kStemCount = 5;
constexpr int kSettleBlocks = 40;
constexpr int kFirstChangeBlock = 100;
constexpr int kChangeBlocks = 6;
constexpr int kBlocksPastChange = 20;
constexpr int64_t kNoFrame = -1;
constexpr int64_t kReferenceBeatLead = 24000;
// An unaccented click reads 0.44 of the accented one before it, two stacked 1.75.
constexpr double kMaxVoiceRatio = 1.0;
constexpr int32_t kFirstBeatAccented[] = {0};

// Picked so input + rate * output latency is not whole on the config they run.
struct LagCase {
  float rate;
  int stems;
  int64_t beat_frame;
  const char* walk_label;
  const char* click_label;
};
constexpr LagCase kCases[] = {
    {0.51f,
     kStemCount,
     27580,
     "lag: no step back at a rate change on presetDefault",
     "lag: a beat at the change sounds one voice on presetDefault"},
    {0.6099999f,
     1,
     35135,
     "lag: no step back at a rate change on the chosen config",
     "lag: a beat at the change sounds one voice on the chosen config"},
};

void LoadStems(kitbag::Mixer* mixer, int stems) {
  for (int t = 0; t < stems; ++t) LoadSilence(mixer, t, kStemFrames);
  for (int t = 1; t < stems; ++t) {
    mixer->SetTrackPitch(t, static_cast<float>(t), kZeroClock, false);
  }
}

// Below 1.0x a song frame repeats; it must never go lower.
bool StepsBack(kitbag::Mixer* mixer, int blocks, int64_t* last) {
  bool back = false;
  for (int b = 0; b < blocks; ++b) {
    RenderPaced(mixer, 1);
    const kitbag::SongClock& clock = mixer->song_clock();
    for (uint32_t i = 0; clock.playing && i < clock.frames; ++i) {
      const int64_t frame = clock.PointAt(i).frame;
      back |= *last != kNoFrame && frame < *last;
      *last = frame;
    }
  }
  return back;
}

int StepsBackAfterChange(const LagCase& lag, int change_block) {
  kitbag::Mixer mixer(kSampleRate);
  LoadStems(&mixer, lag.stems);
  mixer.SetRate(lag.rate, kZeroClock, false);
  mixer.Play();
  int64_t last = kNoFrame;
  bool back = StepsBack(&mixer, change_block, &last);
  mixer.SetRate(kitbag::kUnityRate, kZeroClock, false);
  back |= StepsBack(&mixer, kBlocksPastChange, &last);
  return back ? 1 : 0;
}

int StepsBackAfterHandOver(const LagCase& lag, int change_block) {
  kitbag::Mixer mixer(kSampleRate);
  LoadStems(&mixer, lag.stems);
  mixer.SetRate(lag.rate, kZeroClock, false);
  mixer.SetRate(kitbag::kUnityRate, kZeroClock, false);
  mixer.Seek(0, kZeroClock, false);
  mixer.Play();
  RenderPaced(&mixer, kSettleBlocks);
  mixer.SetRate(lag.rate, kZeroClock, false);
  int64_t last = kNoFrame;
  bool back = StepsBack(&mixer, HandOverBlocks(mixer) + change_block, &last);
  mixer.SetRate(kitbag::kUnityRate, kZeroClock, false);
  back |= StepsBack(&mixer, kBlocksPastChange, &last);
  return back ? 1 : 0;
}

void CheckNoChangeStepsBack(
    int (*steps_back)(const LagCase&, int),
    const LagCase& lag,
    const char* label
) {
  int steps = 0;
  for (int k = 0; k < kChangeBlocks; ++k) {
    steps += steps_back(lag, kFirstChangeBlock + k);
  }
  Check(steps == 0, label);
  if (steps > 0) {
    std::fprintf(
        stderr,
        "  %d of %d change blocks stepped back\n",
        steps,
        kChangeBlocks
    );
  }
}

void FollowTwoBeats(kitbag::Metronome* metronome, int64_t beat_frame) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  const auto beat = static_cast<double>(beat_frame);
  grid->beat_times_sec = {
      (beat - kReferenceBeatLead) / kSampleRate,
      beat / kSampleRate
  };
  grid->bars =
      kitbag::GridBars(kFirstBeatAccented, grid->beat_times_sec.size());
  metronome->SetTimeSignature(4, 4);
  metronome->SetGrid(std::move(grid), 0, true);
  metronome->SetFollowMixer(true);
  metronome->Start();
}

std::vector<float> RenderAcrossTheChange(const LagCase& lag) {
  kitbag::Mixer mixer(kSampleRate);
  kitbag::Metronome metronome;
  LoadStems(&mixer, lag.stems);
  FollowTwoBeats(&metronome, lag.beat_frame);
  mixer.SetRate(lag.rate, kZeroClock, false);
  mixer.Play();
  std::vector<float> left;
  std::vector<float> out(static_cast<size_t>(kBlock) * 2);
  for (int b = 0; b < kFirstChangeBlock + 2 * kBlocksPastChange; ++b) {
    if (b == kFirstChangeBlock) {
      mixer.SetRate(kitbag::kUnityRate, kZeroClock, false);
    }
    WaitForReadAhead(mixer);
    mixer.Process(out.data(), kBlock, kUnclockedFrame);
    metronome
        .Render(out.data(), kBlock, kSampleRate, 2, 0, &mixer.song_clock());
    AppendLeft(&left, out, kBlock);
  }
  return left;
}

void TestBeatAtTheChangeSoundsOnce(const LagCase& lag) {
  const std::vector<float> left = RenderAcrossTheChange(lag);
  const std::vector<int64_t> clicks = click_take::DetectClicks(left);
  const double ratio = clicks.size() >= 2 ? VoiceEnergy(left, clicks[1]) /
                                                VoiceEnergy(left, clicks[0])
                                          : 0.0;
  Check(ratio > 0.0 && ratio <= kMaxVoiceRatio, lag.click_label);
  if (ratio <= 0.0 || ratio > kMaxVoiceRatio) {
    std::fprintf(stderr, "  %zu clicks, ratio %.2f\n", clicks.size(), ratio);
  }
}

}  // namespace

void RunLagCarryTests() {
  for (const LagCase& lag : kCases) {
    CheckNoChangeStepsBack(StepsBackAfterChange, lag, lag.walk_label);
    TestBeatAtTheChangeSoundsOnce(lag);
  }
  CheckNoChangeStepsBack(
      StepsBackAfterHandOver,
      kCases[1],
      "lag: no step back at a change after a hand-over"
  );
}

}  // namespace mixer_test
