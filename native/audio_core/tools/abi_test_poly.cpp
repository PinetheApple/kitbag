#include "kitbag_api.h"

#include <cmath>
#include <vector>

#include "abi_test_metronome.h"
#include "check.h"
#include "metronome/metronome.h"

namespace abi_test {
namespace {

using kitbag::Metronome;
using kitbag_test::Check;

constexpr uint32_t kChannels = 2;
constexpr int32_t kPolyBeats = 3;
constexpr int32_t kBeatsPerBar = 4;
constexpr double kPhaseTolerance = 1e-12;
constexpr double kPolyNormalPeak = 0.5;
constexpr double kPolyAccentPeak = 0.8;
constexpr double kPeakTolerance = 0.05;
constexpr double kSilentCeiling = 0.1;

double RenderPeak(kb_engine* engine, uint32_t frames) {
  std::vector<float> out(static_cast<size_t>(frames) * kChannels);
  kb_engine_render(engine, out.data(), frames);
  double peak = 0.0;
  for (const float sample : out) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(sample)));
  }
  return peak;
}

uint32_t ThirdSecondFrames(const kb_engine* engine) {
  return kb_engine_sample_rate(engine) / 3;
}

bool Near(double actual, double expected) {
  return std::fabs(actual - expected) <= kPeakTolerance;
}

kb_engine* PolyOnlyEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_set_tempo(engine, 120.0);
  kb_metronome_set_beats(engine, kBeatsPerBar, 4);
  kb_metronome_set_poly(engine, 1, kPolyBeats);
  for (int32_t beat = 0; beat < kBeatsPerBar; ++beat) {
    kb_metronome_set_accent(engine, beat, KB_ACCENT_MUTED);
  }
  return engine;
}

// At 120 BPM 3:2 sounds poly tick 1 a third of a second in; 3:4 waits until
// two thirds, so the window [1/3 s, 2/3 s) tells the two apart.
double SecondThirdPeak(kb_engine* engine) {
  kb_metronome_start(engine);
  RenderPeak(engine, ThirdSecondFrames(engine));
  return RenderPeak(engine, ThirdSecondFrames(engine));
}

void TestAgainstSetsTheCycle() {
  kb_engine* engine = PolyOnlyEngine();
  if (engine == nullptr) return;
  kb_metronome_set_poly_against(engine, 2);
  Check(
      Near(SecondThirdPeak(engine), kPolyNormalPeak) &&
          kb_metronome_current_poly_beat(engine) == 1,
      "set_poly_against: 2 puts poly tick 1 a third of a second in"
  );
  Check(
      Near(RenderPeak(engine, ThirdSecondFrames(engine)), kPolyNormalPeak) &&
          Near(RenderPeak(engine, ThirdSecondFrames(engine)), kPolyAccentPeak),
      "set_poly_against: 3:2 restarts its cycle, accented, on beat 3"
  );
  kb_engine_destroy(engine);
}

void TestAgainstBar() {
  kb_engine* engine = PolyOnlyEngine();
  if (engine == nullptr) return;
  kb_metronome_set_poly_against(engine, 2);
  kb_metronome_set_poly_against(engine, KB_POLY_AGAINST_BAR);
  Check(
      SecondThirdPeak(engine) < kSilentCeiling,
      "set_poly_against: KB_POLY_AGAINST_BAR returns the cycle to the bar"
  );
  kb_engine_destroy(engine);
}

void TestAgainstIgnoresOutOfRange() {
  kb_engine* engine = PolyOnlyEngine();
  if (engine == nullptr) return;
  kb_metronome_set_poly_against(engine, 2);
  kb_metronome_set_poly_against(engine, Metronome::kMaxPolyAgainst + 1);
  kb_metronome_set_poly_against(engine, KB_POLY_AGAINST_BAR - 1);
  kb_metronome_set_poly_against(nullptr, KB_POLY_AGAINST_BAR);
  Check(
      Near(SecondThirdPeak(engine), kPolyNormalPeak),
      "set_poly_against: above max, negative and null engine are ignored"
  );
  kb_engine_destroy(engine);
}

void TestAgainstLowerBound() {
  kb_engine* low = PolyOnlyEngine();
  if (low == nullptr) return;
  kb_metronome_set_poly_against(low, Metronome::kMinPolyAgainst);
  Check(
      Near(SecondThirdPeak(low), kPolyAccentPeak),
      "set_poly_against: kMinPolyAgainst plays 3 per beat, cycle on beat 2"
  );
  kb_engine_destroy(low);
}

void TestAgainstUpperBound() {
  kb_engine* high = PolyOnlyEngine();
  if (high == nullptr) return;
  kb_metronome_set_poly_against(high, Metronome::kMaxPolyAgainst);
  kb_metronome_start(high);
  RenderPeak(high, kb_engine_sample_rate(high) * 2 / 3);
  Check(
      RenderPeak(high, kb_engine_sample_rate(high) * 2 / 3) < kSilentCeiling,
      "set_poly_against: kMaxPolyAgainst is accepted, no tick at 2/3 s"
  );
  kb_engine_destroy(high);
}

bool NearPhase(double actual, double expected) {
  return std::fabs(actual - expected) <= kPhaseTolerance;
}

// 120 BPM in 4/4: one beat is half a second, so `beats` is a frame count.
double PhaseAfterBeats(kb_engine* engine, uint32_t beats) {
  RenderPeak(engine, kb_engine_sample_rate(engine) / 2 * beats);
  return kb_metronome_poly_downbeat_phase(engine);
}

void TestDownbeatPhaseFiveThree() {
  kb_engine* engine = PolyOnlyEngine();
  if (engine == nullptr) return;
  kb_metronome_set_poly(engine, 1, 5);
  kb_metronome_set_poly_against(engine, 3);
  kb_metronome_start(engine);
  const bool bar1 = NearPhase(PhaseAfterBeats(engine, 2), 0.0);
  const bool bar2 = NearPhase(PhaseAfterBeats(engine, 4), 1.0 / 3.0);
  const bool bar3 = NearPhase(PhaseAfterBeats(engine, 4), 2.0 / 3.0);
  const bool bar4 = NearPhase(PhaseAfterBeats(engine, 4), 0.0);
  Check(
      bar1 && bar2 && bar3 && bar4,
      "poly_downbeat_phase: 5:3 in 4/4 reads 0, 1/3, 2/3, 0 over bars 1-4"
  );
  kb_engine_destroy(engine);
}

void TestDownbeatPhaseAcrossMeterChange() {
  kb_engine* engine = PolyOnlyEngine();
  if (engine == nullptr) return;
  kb_metronome_set_poly(engine, 1, 5);
  kb_metronome_set_poly_against(engine, 3);
  kb_metronome_start(engine);
  const bool before = NearPhase(PhaseAfterBeats(engine, 5), 1.0 / 3.0);
  kb_metronome_set_beats(engine, 5, 4);
  const bool first = NearPhase(PhaseAfterBeats(engine, 1), 2.0 / 3.0);
  const bool second = NearPhase(PhaseAfterBeats(engine, 5), 1.0 / 3.0);
  Check(
      before && first && second,
      "poly_downbeat_phase: explicit 3 keeps its cycle across 4/4 -> 5/4"
  );
  Check(
      kb_metronome_poly_downbeat_phase(nullptr) == KB_POLY_PHASE_NONE,
      "poly_downbeat_phase: a null engine reads KB_POLY_PHASE_NONE"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunPolyAbiTests() {
  TestAgainstSetsTheCycle();
  TestAgainstBar();
  TestAgainstIgnoresOutOfRange();
  TestAgainstLowerBound();
  TestAgainstUpperBound();
  TestDownbeatPhaseFiveThree();
  TestDownbeatPhaseAcrossMeterChange();
}

}  // namespace abi_test
