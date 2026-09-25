#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr int64_t kApplyFrame = int64_t{150} * kBlockFrames;
constexpr int64_t kPauseFrame = int64_t{1500} * kBlockFrames;
constexpr int64_t kResumeFrame = int64_t{1600} * kBlockFrames;
constexpr int64_t kOnsetSlack = 2;

void ArmTimeRamp(kitbag::Metronome& metronome) {
  metronome.SetRamp(true, 60.0, 120.0, 10.0, kRampSeconds, false);
}

bool Near(int64_t actual, int64_t expected) {
  return std::abs(actual - expected) <= kOnsetSlack;
}

void TestLiveApplyMidBarInSeconds() {
  kitbag::Metronome metronome;
  metronome.SetTempo(100.0);
  metronome.Start();
  const auto onsets =
      RenderContinuous(metronome, int64_t{kSampleRate} * 5, [&](int64_t at) {
        if (at == kApplyFrame) ArmTimeRamp(metronome);
      });
  Check(
      onsets.size() >= 6 && Near(onsets[2], 70400),
      "ramp live: arming mid-beat jumps to 60 BPM keeping the beat's phase"
  );
  Check(
      onsets.size() >= 6 && Near(onsets[5] - onsets[4], 37895),
      "ramp live: time counts from the apply frame, so bar 1 steps to 76 BPM"
  );
}

void TestPauseRestartsRamp() {
  kitbag::Metronome fresh;
  ArmTimeRamp(fresh);
  fresh.Start();
  const auto expected = RenderAndDetectOnsets(fresh, int64_t{kSampleRate} * 8);
  kitbag::Metronome paused;
  ArmTimeRamp(paused);
  paused.Start();
  const auto onsets = RenderContinuous(
      paused,
      kResumeFrame + int64_t{kSampleRate} * 8,
      [&](int64_t at) {
        if (at == kPauseFrame) paused.Pause();
        if (at == kResumeFrame) paused.Start();
      }
  );
  const auto resumed =
      std::find_if(onsets.begin(), onsets.end(), [](int64_t onset) {
        return onset >= kResumeFrame;
      });
  bool same = expected.size() >= 6 && onsets.end() - resumed >= 6;
  for (size_t i = 0; same && i < 6; ++i) {
    same = Near(resumed[static_cast<ptrdiff_t>(i)] - kResumeFrame, expected[i]);
  }
  Check(same, "ramp pause: start after pause replays the ramp from 60 BPM");
}

}  // namespace

void RunRampLiveTests() {
  TestLiveApplyMidBarInSeconds();
  TestPauseRestartsRamp();
}

}  // namespace metronome_test
