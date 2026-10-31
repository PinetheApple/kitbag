#include "metronome_test_poly_model.h"

namespace metronome_test {
namespace {

constexpr double kRunSeconds = 30.0;
constexpr double kLongRunSeconds = 60.0;

int64_t FramesFor(double seconds) {
  return static_cast<int64_t>(seconds * kSampleRate);
}

std::vector<float> RenderSetup(const PolySetup& setup, int64_t frames) {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, setup);
  return RenderPolyLeft(metronome, frames, [](int64_t) {});
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
      RenderPolyLeft(metronome, frames, [](int64_t) {})
  );
}

// D1: below a scale of 1 the old boundary test re-fired a tick on the next
// sample; above 1 it skipped ticks. 400 BPM puts both inside one minute.
void TestRoundingAtMaxTempo() {
  ExpectConstant(
      {3, KB_POLY_AGAINST_BAR, 4, 4, kitbag::kMaxBpm},
      kLongRunSeconds
  );
  ExpectConstant(
      {9, KB_POLY_AGAINST_BAR, 4, 4, kitbag::kMaxBpm},
      kLongRunSeconds
  );
}

bool SameSamples(const std::vector<float>& a, const std::vector<float>& b) {
  return a.size() == b.size() &&
         std::equal(a.begin(), a.end(), b.begin(), [](float x, float y) {
           return x == y;
         });
}

std::vector<float> RenderDefault(const PolySetup& setup, int64_t frames) {
  kitbag::Metronome metronome;
  metronome.SetTempo(setup.bpm);
  metronome.SetTimeSignature(setup.numerator, setup.denominator);
  metronome.SetPolyrhythm(true, setup.poly);
  metronome.Start();
  return RenderPolyLeft(metronome, frames, [](int64_t) {});
}

std::vector<float> RenderExplicit(const PolySetup& setup, int64_t frames) {
  kitbag::Metronome metronome;
  metronome.SetTempo(setup.bpm);
  metronome.SetTimeSignature(setup.numerator, setup.denominator);
  metronome.SetPolyrhythm(true, setup.poly);
  metronome.SetPolyAgainst(setup.against);
  metronome.Start();
  return RenderPolyLeft(metronome, frames, [](int64_t) {});
}

void ExpectDefaultMatches(const PolySetup& setup) {
  const int64_t frames = FramesFor(kRunSeconds);
  const std::vector<float> fallback = RenderDefault(setup, frames);
  Check(
      SameSamples(fallback, RenderExplicit(setup, frames)),
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
  TestRoundingAtMaxTempo();
  TestDefaultIsTheBar();
}

}  // namespace metronome_test
