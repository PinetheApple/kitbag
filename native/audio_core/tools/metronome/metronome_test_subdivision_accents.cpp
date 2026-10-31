#include <array>
#include <string>

#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

using kitbag::Accent;

constexpr int kTom = 3;
constexpr int kBeatsPerBar = 4;
constexpr int64_t kBarFrames = kBeatsPerBar * kBeatFrames;
constexpr double kTomBeatHz = 450.0;
constexpr double kTomSubdivisionHz = 300.0;
constexpr double kTomPolyHz = 520.0;
constexpr double kBeepAccentHz = 1760.0;
constexpr double kSilentCeiling = 0.01;
constexpr double kPolyNormalPeak = 0.5;
constexpr double kPeakTolerance = 0.05;
constexpr double kGridIntervalSec = 0.6;
constexpr int kGridBeats = 12;
constexpr auto kGridBeatFrames =
    static_cast<int64_t>(kGridIntervalSec * kSampleRate);
constexpr int kSilent = 0;

using BarAccents = std::array<Accent, kBeatsPerBar>;

constexpr BarAccents kDefaultBar = {
    Accent::kAccented,
    Accent::kNormal,
    Accent::kNormal,
    Accent::kNormal,
};

constexpr int32_t SlotBit(int slot) {
  return int32_t{1} << slot;
}

double ExpectedHz(Accent beat, int slot, int32_t mask) {
  if (beat == Accent::kMuted) return kSilent;
  if (slot == 0) {
    return beat == Accent::kAccented ? kHihatAccentHz : kTomBeatHz;
  }
  return (mask & SlotBit(slot)) != 0 ? kHihatAccentHz : kTomSubdivisionHz;
}

bool TickMatches(const std::vector<float>& left, int64_t onset, double hz) {
  if (hz == kSilent) return PeakIn(left, onset) < kSilentCeiling;
  return PitchIs(left, onset, hz);
}

struct BarSpec {
  int64_t start;
  int64_t beat_frames;
  int subdivision;
  int32_t mask;
  BarAccents accents;
};

bool ExpectBar(const std::vector<float>& left, const BarSpec& bar) {
  for (int beat = 0; beat < kBeatsPerBar; ++beat) {
    for (int slot = 0; slot < bar.subdivision; ++slot) {
      const int64_t onset = bar.start + beat * bar.beat_frames +
                            slot * bar.beat_frames / bar.subdivision;
      const double hz = ExpectedHz(bar.accents[beat], slot, bar.mask);
      if (TickMatches(left, onset, hz)) continue;
      std::fprintf(
          stderr,
          "  beat %d slot %d at %lld: want %.0f Hz, measured %.0f Hz\n",
          beat,
          slot,
          static_cast<long long>(onset),
          hz,
          PitchAt(left, onset)
      );
      return false;
    }
  }
  return true;
}

void StartTomHihat(kitbag::Metronome& metronome, const BarAccents& accents) {
  metronome.SetSounds(kTom, kHihatSound);
  metronome.SetTempo(120.0);
  metronome.SetTimeSignature(kBeatsPerBar, 4);
  for (int beat = 0; beat < kBeatsPerBar; ++beat) {
    metronome.SetAccent(beat, accents[beat]);
  }
  metronome.Start();
}

void TestThirdTickOfFourAccented() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, SlotBit(2));
  StartTomHihat(metronome, kDefaultBar);
  const auto left = RenderLeft(metronome, 2 * kBarFrames);
  for (int bar = 0; bar < 2; ++bar) {
    CheckCase(
        ExpectBar(
            left,
            {bar * kBarFrames, kBeatFrames, 4, SlotBit(2), kDefaultBar}
        ),
        "sub accents: sub 4 slot 2, bar " + std::to_string(bar),
        "every beat's third tick plays the accent sound, the rest unchanged"
    );
  }
}

void TestAccentClickWhenSoundsMatch() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(2);
  metronome.SetSubdivisionAccents(2, SlotBit(1));
  metronome.SetTempo(120.0);
  metronome.Start();
  const auto left = RenderLeft(metronome, kBarFrames);
  CheckCase(
      PitchIs(left, kBeatFrames + kBeatFrames / 2, kBeepAccentHz),
      "sub accents: default sounds, the accented off-beat is the accent click",
      "not the normal sound's subdivision voice made louder"
  );
}

constexpr BarAccents kMixedBar = {
    Accent::kAccented,
    Accent::kNormal,
    Accent::kMuted,
    Accent::kNormal,
};

void TestSlotZeroAloneChangesNothing() {
  kitbag::Metronome plain;
  plain.SetSubdivision(4);
  StartTomHihat(plain, kMixedBar);
  const auto plain_left = RenderLeft(plain, kBarFrames);
  kitbag::Metronome slot_zero;
  slot_zero.SetSubdivision(4);
  slot_zero.SetSubdivisionAccents(4, SlotBit(0));
  StartTomHihat(slot_zero, kMixedBar);
  const auto left = RenderLeft(slot_zero, kBarFrames);
  CheckCase(
      SameSamples(left, 0, plain_left, 0, kBarFrames),
      "sub accents: slot 0 alone changes nothing",
      "accented, normal and muted beats must render as with an empty row"
  );
}

void TestSlotZeroBesideSlotTwo() {
  const int32_t mask = SlotBit(0) | SlotBit(2);
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, mask);
  StartTomHihat(metronome, kMixedBar);
  const auto left = RenderLeft(metronome, kBarFrames);
  CheckCase(
      ExpectBar(left, {0, kBeatFrames, 4, mask, kMixedBar}),
      "sub accents: slot 0 beside slot 2 still leaves every beat alone",
      "on-beat ticks follow per-beat accents only"
  );
}

void TestMutedBeatSilencesItsAccents() {
  constexpr BarAccents kSecondMuted = {
      Accent::kAccented,
      Accent::kMuted,
      Accent::kNormal,
      Accent::kNormal,
  };
  const int32_t off_beats = SlotBit(1) | SlotBit(2) | SlotBit(3);
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, off_beats);
  StartTomHihat(metronome, kSecondMuted);
  const auto left = RenderLeft(metronome, kBarFrames);
  bool silent = true;
  for (int slot = 1; slot < 4; ++slot) {
    silent = silent && PeakIn(left, kBeatFrames + slot * kBeatFrames / 4) <
                           kSilentCeiling;
  }
  CheckCase(
      silent,
      "sub accents: a muted beat silences its accented ticks",
      ""
  );
  CheckCase(
      ExpectBar(left, {0, kBeatFrames, 4, off_beats, kSecondMuted}),
      "sub accents: unmuted beats around it keep their accented ticks",
      ""
  );
}

void TestSubdivisionChangePicksNewRow() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, SlotBit(2));
  metronome.SetSubdivisionAccents(3, SlotBit(1));
  StartTomHihat(metronome, kDefaultBar);
  const auto left = RenderLeft(metronome, 2 * kBarFrames, [&](int64_t at) {
    if (at == kBarFrames) metronome.SetSubdivision(3);
  });
  CheckCase(
      ExpectBar(left, {0, kBeatFrames, 4, SlotBit(2), kDefaultBar}),
      "sub accents: row 4 drives the sub-4 bar",
      ""
  );
  CheckCase(
      ExpectBar(left, {kBarFrames, kBeatFrames, 3, SlotBit(1), kDefaultBar}),
      "sub accents: after a change to sub 3, row 3 drives the bar",
      ""
  );
}

void TestTablePersistsAcrossStopStart() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, SlotBit(3));
  StartTomHihat(metronome, kDefaultBar);
  RenderLeft(metronome, kBarFrames);
  metronome.Stop();
  RenderLeft(metronome, kBeatFrames);
  metronome.Start();
  CheckCase(
      ExpectBar(
          RenderLeft(metronome, kBarFrames),
          {0, kBeatFrames, 4, SlotBit(3), kDefaultBar}
      ),
      "sub accents: the table survives stop and start",
      ""
  );
}

void TestPolyTicksUnaffected() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, SlotBit(1) | SlotBit(2) | SlotBit(3));
  metronome.SetPolyrhythm(true, 3);
  StartTomHihat(metronome, kDefaultBar);
  const auto left = RenderLeft(metronome, kBarFrames);
  const int64_t poly_tick = kBarFrames / 3;
  CheckCase(
      PitchIs(left, poly_tick, kTomPolyHz) &&
          std::fabs(PeakIn(left, poly_tick) - kPolyNormalPeak) < kPeakTolerance,
      "sub accents: a normal poly tick keeps its voice and level",
      ""
  );
}

void TestGridSubdivisionsAccented() {
  kitbag::Metronome metronome;
  metronome.SetSubdivision(4);
  metronome.SetSubdivisionAccents(4, SlotBit(2));
  metronome
      .SetGrid(MakeShiftedGrid(kGridBeats, 0.0, kGridIntervalSec), 0, true);
  StartTomHihat(metronome, kDefaultBar);
  const auto left =
      RenderLeft(metronome, kBeatsPerBar * kGridBeatFrames + kBlockFrames);
  CheckCase(
      ExpectBar(left, {0, kGridBeatFrames, 4, SlotBit(2), kDefaultBar}),
      "sub accents: grid mode accents the same slot of each measured beat",
      ""
  );
}

}  // namespace

void RunSubdivisionAccentTests() {
  TestThirdTickOfFourAccented();
  TestAccentClickWhenSoundsMatch();
  TestSlotZeroAloneChangesNothing();
  TestSlotZeroBesideSlotTwo();
  TestMutedBeatSilencesItsAccents();
  TestSubdivisionChangePicksNewRow();
  TestTablePersistsAcrossStopStart();
  TestPolyTicksUnaffected();
  TestGridSubdivisionsAccented();
}

}  // namespace metronome_test
