#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

constexpr int kWoodblock = 1;
constexpr int kClick = 2;
constexpr int kTom = 3;
constexpr int kHihat = 4;

constexpr double kBeepAccentHz = 1760.0;
constexpr double kBeepBeatHz = 1174.7;
constexpr double kWoodblockAccentHz = 2400.0;
constexpr double kWoodblockBeatHz = 1800.0;
constexpr double kClickAccentHz = 3600.0;
constexpr double kTomBeatHz = 450.0;
constexpr double kHihatAccentHz = 5000.0;
constexpr double kSilentCeiling = 0.01;

constexpr int64_t kWaltzBeatFrames = 28800;
constexpr int64_t kWaltzBarFrames = 3 * kWaltzBeatFrames;
constexpr int64_t kFiveEightBarFrames = int64_t{5} * 16000;
constexpr int64_t kCommonBeatFrames = kSampleRate / 2;
constexpr int64_t kCommonBarFrames = 4 * kCommonBeatFrames;

int64_t Block(int64_t index) {
  return index * kBlockFrames;
}

std::vector<float> RenderWaltz(int count_in_bars) {
  kitbag::Metronome metronome;
  metronome.SetCountIn(count_in_bars, true, kWoodblock);
  metronome.SetTempo(100.0);
  metronome.SetTimeSignature(3, 4);
  metronome.Start();
  return RenderLeft(
      metronome,
      int64_t{2} * count_in_bars * kWaltzBarFrames + kWaltzBarFrames
  );
}

void TestCountInLengthIsSampleAccurate() {
  const int64_t bar_one = 2 * kWaltzBarFrames;
  const auto counted = RenderWaltz(2);
  const auto plain = RenderWaltz(0);

  bool count_beats = true;
  for (int64_t beat = 0; beat < 6; ++beat) {
    const double hz = beat % 3 == 0 ? kWoodblockAccentHz : kWoodblockBeatHz;
    count_beats = count_beats && PitchIs(counted, beat * kWaltzBeatFrames, hz);
  }
  Check(count_beats, "count-in: six woodblock beats for 2 bars of 3/4");
  Check(
      PeakIn(counted, bar_one - kPitchWindow) < kSilentCeiling,
      "count-in: nothing sounds just before bar one"
  );
  Check(
      SameSamples(counted, bar_one, plain, 0, kWaltzBarFrames),
      "count-in: bar one lands exactly 172800 frames after start"
  );
}

std::vector<float>
RenderChangedBeforeStart(int count_in_bars, int subdivision) {
  kitbag::Metronome metronome;
  metronome.SetCountIn(count_in_bars, true, kWoodblock);
  metronome.SetTempo(90.0);
  metronome.SetTimeSignature(5, 8);
  metronome.SetSubdivision(subdivision);
  metronome.Start();
  return RenderLeft(metronome, 2 * kFiveEightBarFrames + kBlockFrames);
}

void TestChangesBeforeStartSetCountLength() {
  const int64_t bar_one = kFiveEightBarFrames;
  const auto counted = RenderChangedBeforeStart(1, 3);
  const auto plain = RenderChangedBeforeStart(0, 3);
  const auto unsubdivided = RenderChangedBeforeStart(1, 1);
  Check(
      SameSamples(counted, bar_one, plain, 0, bar_one),
      "count-in: 90 BPM 5/8 set after it gives a 5-eighth count of 80000 frames"
  );
  Check(
      SameSamples(counted, 0, unsubdivided, 0, bar_one),
      "count-in: subdivision does not add clicks to the count"
  );
}

void TestPauseResumeAndStopStart() {
  kitbag::Metronome metronome;
  metronome.SetCountIn(1, true, kWoodblock);
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(4, 4);
  metronome.Start();
  const auto left = RenderLeft(metronome, Block(760), [&](int64_t at) {
    if (at == Block(50)) metronome.Pause();
    if (at == Block(80)) metronome.Start();
    if (at == Block(586)) metronome.Pause();
    if (at == Block(640)) metronome.Start();
    if (at == Block(700)) metronome.Stop();
    if (at == Block(720)) metronome.Start();
  });

  Check(
      PitchIs(left, Block(80), kBeepAccentHz),
      "count-in: resume after a pause mid-count starts bar one, no count"
  );
  Check(
      PitchIs(left, Block(640), kBeepAccentHz),
      "count-in: resume after a pause mid-bar starts without a count"
  );
  Check(
      PitchIs(left, Block(720), kWoodblockAccentHz),
      "count-in: stop then start replays the count"
  );
}

void TestSameSoundAndInvalidValues() {
  kitbag::Metronome same;
  same.SetSounds(kTom, kHihat);
  same.SetCountIn(1, false, kWoodblock);
  same.SetTempo(120.0);
  same.Start();
  const auto same_left = RenderLeft(same, kCommonBarFrames);
  Check(
      PitchIs(same_left, 0, kHihatAccentHz) &&
          PitchIs(same_left, kCommonBeatFrames, kTomBeatHz),
      "count-in: same mode counts with the accent and normal sounds"
  );

  kitbag::Metronome invalid;
  invalid.SetCountIn(1, true, kClick);
  invalid.SetCountIn(3, true, kitbag::Metronome::kSoundCount);
  invalid.SetTempo(120.0);
  invalid.Start();
  const auto left = RenderLeft(invalid, 2 * kCommonBarFrames);
  Check(
      PitchIs(left, 0, kClickAccentHz),
      "count-in: an out-of-table sound keeps the previous count sound"
  );
  Check(
      PitchIs(left, kCommonBarFrames, kBeepAccentHz),
      "count-in: 3 bars is not a choice, the previous 1 bar stays"
  );
}

struct MirrorLog {
  bool counting_before_bar_one = true;
  bool phase_in_range = true;
  int32_t beat_after_second_count_beat = -1;
  bool counting_after_bar_one = false;
};

void RecordMirrors(
    const kitbag::Metronome& metronome,
    int64_t at,
    MirrorLog* log
) {
  const double phase = metronome.bar_phase();
  log->phase_in_range = log->phase_in_range && phase >= 0.0 && phase < 1.0;
  if (at <= kCommonBarFrames) {
    log->counting_before_bar_one =
        log->counting_before_bar_one && metronome.counting_in();
  } else {
    log->counting_after_bar_one =
        log->counting_after_bar_one || metronome.counting_in();
  }
  if (at == Block(kCommonBeatFrames / kBlockFrames + 1)) {
    log->beat_after_second_count_beat = metronome.current_beat();
  }
}

void TestCountInMirrors() {
  kitbag::Metronome metronome;
  metronome.SetCountIn(1, true, kWoodblock);
  metronome.SetTempo(120.0);
  metronome.Start();
  MirrorLog log;
  RenderLeft(metronome, 2 * kCommonBarFrames, [&](int64_t at) {
    if (at > 0) RecordMirrors(metronome, at, &log);
  });

  Check(
      log.counting_before_bar_one,
      "count-in mirror: set for every count block"
  );
  Check(!log.counting_after_bar_one, "count-in mirror: clear from bar one on");
  Check(log.phase_in_range, "count-in mirror: bar_phase stays in [0, 1)");
  Check(
      log.beat_after_second_count_beat == 1,
      "count-in mirror: current_beat follows the count beats"
  );
}

void TestGridSkipsCountIn() {
  kitbag::Metronome gridded;
  gridded.SetCountIn(1, true, kWoodblock);
  gridded.SetGrid(MakeShiftedGrid(16, 1.0, 0.5), 0, true);
  gridded.Start();
  bool counting = false;
  const auto left = RenderLeft(gridded, kCommonBarFrames, [&](int64_t at) {
    counting = counting || gridded.counting_in();
    if (at == Block(100)) gridded.ClearGrid(static_cast<uint64_t>(at), true);
  });
  Check(!counting, "count-in: grid mode never reports a count");
  Check(
      PitchIs(left, 2 * kCommonBeatFrames, kBeepBeatHz),
      "count-in: a grid cleared before its first beat leaves no count behind"
  );
}

void TestAnchorSkipsCountIn() {
  constexpr int64_t kAnchorFrame = 2560;
  kitbag::Metronome anchored;
  anchored.SetCountIn(1, true, kWoodblock);
  anchored.Start();
  const auto left = RenderLeft(anchored, kCommonBarFrames, [&](int64_t at) {
    if (at == kAnchorFrame) {
      anchored.AnchorExternal(-1.0, static_cast<uint64_t>(at), 120.0);
    }
  });
  Check(
      PeakIn(left, kAnchorFrame + kCommonBeatFrames) < kSilentCeiling,
      "count-in: an anchor before song beat 0 cancels the count"
  );
  Check(
      PitchIs(left, kAnchorFrame + 2 * kCommonBeatFrames, kBeepAccentHz),
      "count-in: the anchored click starts on the song's beat 0"
  );
}

void TestStartAtCountsOnEngineClock() {
  constexpr int64_t kStartFrame = 10007;
  kitbag::Metronome counted;
  counted.SetCountIn(1, true, kWoodblock);
  counted.StartAt(kStartFrame);
  kitbag::Metronome plain;
  plain.StartAt(kStartFrame + kCommonBarFrames);
  const int64_t frames = kStartFrame + 2 * kCommonBarFrames;
  const auto counted_left = RenderLeft(counted, frames);
  const auto plain_left = RenderLeft(plain, frames);
  Check(
      SameSamples(
          counted_left,
          kStartFrame + kCommonBarFrames,
          plain_left,
          kStartFrame + kCommonBarFrames,
          kCommonBarFrames
      ),
      "count-in: start_at puts bar one exactly one bar after the start frame"
  );
}

}  // namespace

void RunCountInTests() {
  TestCountInLengthIsSampleAccurate();
  TestChangesBeforeStartSetCountLength();
  TestPauseResumeAndStopStart();
  TestSameSoundAndInvalidValues();
  TestCountInMirrors();
  TestGridSkipsCountIn();
  TestAnchorSkipsCountIn();
  TestStartAtCountsOnEngineClock();
}

}  // namespace metronome_test
