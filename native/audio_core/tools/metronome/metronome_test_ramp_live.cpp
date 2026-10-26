#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr int64_t kApplyFrame = int64_t{150} * kBlockFrames;
constexpr int64_t kPauseFrame = int64_t{1500} * kBlockFrames;
constexpr int64_t kResumeFrame = int64_t{1600} * kBlockFrames;
constexpr int64_t kOnsetSlack = 2;

void ArmTimeRamp(kitbag::Metronome& metronome) {
  metronome.SetRamp(true, 60.0, 120.0, 10.0, 4.5, kRampSeconds, false);
}

bool Near(int64_t actual, int64_t expected) {
  return std::abs(actual - expected) <= kOnsetSlack;
}

void TestLiveApplyMidBarInSeconds() {
  kitbag::Metronome metronome;
  metronome.SetTempo(100.0);
  metronome.Start();
  const auto onsets =
      RenderContinuous(metronome, int64_t{kSampleRate} * 10, [&](int64_t at) {
        if (at == kApplyFrame) ArmTimeRamp(metronome);
      });
  Check(
      onsets.size() >= 6 && Near(onsets[2], 70400),
      "ramp live: arming mid-beat jumps to 60 BPM keeping the beat's phase"
  );
  constexpr int64_t kSixtyBpmBeat = kSampleRate;
  constexpr int64_t kSeventyBpmBeat = 41143;
  constexpr int64_t kStepAfter = kApplyFrame + kSampleRate * 9 / 2;
  size_t first_step = 0;
  for (size_t i = 3; i + 1 < onsets.size(); ++i) {
    if (!Near(onsets[i + 1] - onsets[i], kSixtyBpmBeat)) {
      first_step = i;
      break;
    }
  }
  Check(
      first_step > 0 && onsets[first_step] >= kStepAfter &&
          onsets[first_step - 1] < kStepAfter &&
          Near(onsets[first_step + 1] - onsets[first_step], kSeventyBpmBeat),
      "ramp live: time counts from arming; the first beat after 4.5 s is 70"
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

void TestSecondsRampClampsShortDuration() {
  kitbag::Metronome metronome;
  metronome.SetRamp(true, 400.0, 100.0, 100.0, 0.5, kRampSeconds, false);
  metronome.Start();
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(
      onsets.size() >= 9 && Near(onsets[7] - onsets[6], 7200) &&
          Near(onsets[8] - onsets[7], 9600),
      "ramp live: 0.5 s clamps to 1 s, so the beat after 1 s is 300 BPM"
  );
}

}  // namespace

void RunRampLiveTests() {
  TestLiveApplyMidBarInSeconds();
  TestPauseRestartsRamp();
  TestSecondsRampClampsShortDuration();
}

}  // namespace metronome_test
