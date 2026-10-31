#include "metronome_test_poly_model.h"

namespace metronome_test {
namespace {

constexpr double kLongRunSeconds = 60.0;

std::vector<float> RenderSetup(const PolySetup& setup, int64_t frames) {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, setup);
  return RenderLeft(metronome, frames);
}

void ExpectConstant(const PolySetup& setup, double seconds) {
  const int64_t frames = FramesFor(seconds);
  const std::vector<PolyTick> model =
      ModelPolyTicks({FirstSpan(setup)}, setup.poly, frames);
  ExpectPolyTicks(
      PolyLabel("poly ratio", setup),
      model,
      RenderSetup(setup, frames)
  );
}

void TestRatiosAgainstFourFour() {
  ExpectConstant({3, 2, 4, 4, 120.0}, kRunSeconds);
  ExpectConstant({5, 3, 4, 4, 97.0}, kRunSeconds);
  ExpectConstant({3, 4, 4, 4, 113.0}, kRunSeconds);
  ExpectConstant({7, 6, 4, 4, 88.0}, kRunSeconds);
}

void TestRatiosAgainstSevenEight() {
  ExpectConstant({4, 3, 7, 8, 110.0}, kRunSeconds);
  ExpectConstant({5, 7, 7, 8, 131.0}, kRunSeconds);
  ExpectConstant({3, 9, 7, 8, 104.0}, kRunSeconds);
  ExpectConstant({5, KB_POLY_AGAINST_BAR, 7, 8, 92.0}, kRunSeconds);
}

void TestAgainstBounds() {
  ExpectConstant(
      {3, kitbag::Metronome::kMinPolyAgainst, 4, 4, 90.0},
      kRunSeconds
  );
  ExpectConstant(
      {5, kitbag::Metronome::kMaxPolyAgainst, 4, 4, 180.0},
      kRunSeconds
  );
}

void TestOutOfRangeAgainstIgnored() {
  const PolySetup setup{5, 3, 4, 4, 97.0};
  const int64_t frames = FramesFor(kRunSeconds);
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, setup);
  metronome.SetPolyAgainst(kitbag::Metronome::kMaxPolyAgainst + 1);
  metronome.SetPolyAgainst(KB_POLY_AGAINST_BAR - 1);
  ExpectPolyTicks(
      PolyLabel("out-of-range against keeps", setup),
      ModelPolyTicks({FirstSpan(setup)}, setup.poly, frames),
      RenderLeft(metronome, frames)
  );
}

// At 400 BPM both a poly step below one tick per beat and one above it put a
// tick boundary inside a sample's rounding margin within a minute.
void TestTickBoundariesAtMaxTempo() {
  ExpectConstant(
      {3, KB_POLY_AGAINST_BAR, 4, 4, kitbag::kMaxBpm},
      kLongRunSeconds
  );
  ExpectConstant(
      {9, KB_POLY_AGAINST_BAR, 4, 4, kitbag::kMaxBpm},
      kLongRunSeconds
  );
}

std::vector<float>
RenderWithMainRow(const PolySetup& setup, bool set_against, int64_t frames) {
  kitbag::Metronome metronome;
  metronome.SetTempo(setup.bpm);
  metronome.SetTimeSignature(setup.numerator, setup.denominator);
  metronome.SetPolyrhythm(true, setup.poly);
  if (set_against) metronome.SetPolyAgainst(setup.against);
  metronome.Start();
  return RenderLeft(metronome, frames);
}

void ExpectDefaultMatches(const PolySetup& setup) {
  const int64_t frames = FramesFor(kRunSeconds);
  Check(
      RenderWithMainRow(setup, false, frames) ==
          RenderWithMainRow(setup, true, frames),
      PolyLabel("unset against plays sample-identical to", setup).c_str()
  );
}

void TestDefaultIsTheBar() {
  ExpectDefaultMatches({3, KB_POLY_AGAINST_BAR, 4, 4, 133.0});
  ExpectDefaultMatches({3, 4, 4, 4, 133.0});
  ExpectDefaultMatches({5, KB_POLY_AGAINST_BAR, 7, 8, 92.0});
  ExpectDefaultMatches({5, 7, 7, 8, 92.0});
}

}  // namespace

void RunPolyRatioTests() {
  TestRatiosAgainstFourFour();
  TestRatiosAgainstSevenEight();
  TestAgainstBounds();
  TestOutOfRangeAgainstIgnored();
  TestTickBoundariesAtMaxTempo();
  TestDefaultIsTheBar();
}

}  // namespace metronome_test
