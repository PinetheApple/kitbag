// Offline pitch verification: synthesized tones through PitchAnalyzer, asserting
// the M2 proof (≤±1 cent, 82Hz–1kHz), settle time, octave kill, silence gate;
// then the string-aware tuning mode through the C ABI (tuning_mode_test_*.cpp).
#include <cmath>
#include <cstdio>
#include <cstdlib>

#include "check.h"
#include "tuner/pitch_analyzer.h"
#include "tuning_mode_test_support.h"

namespace {

constexpr double kSampleRate = 48000.0;
constexpr double kTau = 6.283185307179586;
constexpr double kToneAmplitude = 0.5;
constexpr double kA4Hz = 440.0;

constexpr double kMaxCentsError = 1.0;
// SPEC.md §10.1: settle <150ms. Bass B0 needs a ~90ms window, so it gets a looser
// "acceptable settle" budget per the M2 proof.
constexpr double kMaxSettleSeconds = 0.150;
constexpr double kMaxBassSettleSeconds = 0.400;
constexpr double kSettleToleranceCents = 2.0;
constexpr double kToneSeconds = 1.0;

// Reference tones spanning the M2 proof range (guitar low E to 1kHz).
constexpr double kReferenceTonesHz[] = {
    82.41,
    110.0,
    146.83,
    196.0,
    246.94,
    329.63,
    440.0,
    523.25,
    659.26,
    880.0,
    1000.0
};

using kitbag_test::Check;

// Update deliberately when adding or removing a check; a drop means a test
// stopped running.
constexpr int kExpectedChecks = 132;

double CentsBetween(double measured_hz, double true_hz) {
  return 1200.0 * std::log2(measured_hz / true_hz);
}

// Feeds a tone (fundamental + optional harmonics) and returns the time in
// seconds after which the reading stayed within tolerance of true_hz.
double FeedToneAndMeasureSettle(
    kitbag::PitchAnalyzer& analyzer,
    double true_hz,
    double seconds,
    double harmonic2 = 0.0,
    double harmonic3 = 0.0
) {
  const auto total = static_cast<int64_t>(seconds * kSampleRate);
  double settle_seconds = seconds;
  bool settled = false;
  for (int64_t i = 0; i < total; ++i) {
    const double t = static_cast<double>(i) / kSampleRate;
    const double sample =
        kToneAmplitude * (std::sin(kTau * true_hz * t) +
                          harmonic2 * std::sin(kTau * 2.0 * true_hz * t) +
                          harmonic3 * std::sin(kTau * 3.0 * true_hz * t));
    if (!analyzer.Process(static_cast<float>(sample))) {
      continue;
    }
    const auto& reading = analyzer.reading();
    const bool in_tolerance =
        reading.pitch_hz > 0.0 &&
        std::fabs(CentsBetween(reading.pitch_hz, true_hz)) <
            kSettleToleranceCents;
    if (in_tolerance && !settled) {
      settled = true;
      settle_seconds = t;
    } else if (!in_tolerance) {
      settled = false;
      settle_seconds = seconds;
    }
  }
  return settle_seconds;
}

void CheckReferenceTone(double tone_hz) {
  kitbag::PitchAnalyzer analyzer(
      kSampleRate,
      kitbag::PitchAnalyzer::kChromaticLowHz,
      kitbag::PitchAnalyzer::kChromaticHighHz
  );
  const double settle =
      FeedToneAndMeasureSettle(analyzer, tone_hz, kToneSeconds);
  const auto& reading = analyzer.reading();
  const double error_cents =
      reading.pitch_hz > 0.0 ? CentsBetween(reading.pitch_hz, tone_hz) : 999.0;
  std::printf(
      "  %8.2f Hz -> %8.3f Hz  err %+7.3f cents  settle %3.0f ms  conf %.2f\n",
      tone_hz,
      reading.pitch_hz,
      error_cents,
      settle * 1000.0,
      reading.confidence
  );
  Check(
      std::fabs(error_cents) <= kMaxCentsError,
      "reference tone within ±1 cent"
  );
  Check(settle <= kMaxSettleSeconds, "settle under 150ms");
  Check(
      reading.note_index == kitbag::NoteIndexForFrequency(tone_hz, kA4Hz),
      "nearest note index matches"
  );
}

void TestReferenceTones() {
  std::printf(
      "reference tones (chromatic band, ±%.1f cent):\n",
      kMaxCentsError
  );
  for (const double tone_hz : kReferenceTonesHz) {
    CheckReferenceTone(tone_hz);
  }
}

void TestBassB0Settle() {
  // 5-string bass low B via its preset string band — how the app reaches notes
  // below A1. Its ~65ms two-period window earns a looser settle budget (M2).
  constexpr double kB0Hz = 30.87;
  constexpr double kBandSemitones = 5.0;
  kitbag::PitchAnalyzer analyzer(
      kSampleRate,
      kB0Hz * std::exp2(-kBandSemitones / 12.0),
      kB0Hz * std::exp2(kBandSemitones / 12.0)
  );
  const double settle = FeedToneAndMeasureSettle(analyzer, kB0Hz, 2.0);
  const auto& reading = analyzer.reading();
  const double error_cents =
      reading.pitch_hz > 0.0 ? CentsBetween(reading.pitch_hz, kB0Hz) : 999.0;
  std::printf(
      "bass B0: %.2f Hz -> %.3f Hz  err %+.3f cents  settle %.0f ms\n",
      kB0Hz,
      reading.pitch_hz,
      error_cents,
      settle * 1000.0
  );
  Check(std::fabs(error_cents) <= kMaxCentsError, "B0 within ±1 cent");
  Check(settle <= kMaxBassSettleSeconds, "B0 settles acceptably (<400ms)");
}

void TestOctaveErrorKill() {
  // Harmonic-rich low E within the guitar E2 string band (±5 semitones):
  // strong 2nd/3rd harmonics must not pull detection up an octave.
  constexpr double kE2Hz = 82.41;
  constexpr double kBandSemitones = 5.0;
  const double low = kE2Hz * std::exp2(-kBandSemitones / 12.0);
  const double high = kE2Hz * std::exp2(kBandSemitones / 12.0);
  kitbag::PitchAnalyzer analyzer(kSampleRate, low, high);
  FeedToneAndMeasureSettle(analyzer, kE2Hz, kToneSeconds, 0.9, 0.6);
  const auto& reading = analyzer.reading();
  const double error_cents =
      reading.pitch_hz > 0.0 ? CentsBetween(reading.pitch_hz, kE2Hz) : 999.0;
  std::printf(
      "octave kill: E2 + harmonics -> %.3f Hz  err %+.3f cents\n",
      reading.pitch_hz,
      error_cents
  );
  Check(
      std::fabs(error_cents) <= kMaxCentsError,
      "harmonic-rich E2 stays on the fundamental"
  );
}

void TestSilenceGate() {
  kitbag::PitchAnalyzer analyzer(
      kSampleRate,
      kitbag::PitchAnalyzer::kChromaticLowHz,
      kitbag::PitchAnalyzer::kChromaticHighHz
  );
  for (int i = 0; i < static_cast<int>(kSampleRate / 2); ++i) {
    analyzer.Process(0.0f);
  }
  Check(analyzer.reading().pitch_hz == 0.0, "silence reports no pitch");
  Check(analyzer.reading().note_index == -1, "silence reports no note");
}

void TestA4Reference() {
  // 415Hz tone with A4=415 must read as A4 (MIDI 69), 0 cents.
  constexpr double kBaroqueA4Hz = 415.0;
  kitbag::PitchAnalyzer analyzer(
      kSampleRate,
      kitbag::PitchAnalyzer::kChromaticLowHz,
      kitbag::PitchAnalyzer::kChromaticHighHz
  );
  analyzer.SetA4(kBaroqueA4Hz);
  FeedToneAndMeasureSettle(analyzer, kBaroqueA4Hz, kToneSeconds);
  const auto& reading = analyzer.reading();
  std::printf(
      "A4=415: note %d  cents %+.3f\n",
      reading.note_index,
      reading.cents
  );
  Check(reading.note_index == 69, "415Hz reads as A4 when A4=415");
  Check(std::fabs(reading.cents) <= kMaxCentsError, "415Hz reads as 0 cents");
}

// Returns the number of tuning-mode checks run, or -1 without an engine.
int RunTuningModeTests() {
  const int checks_before = kitbag_test::g_checks;
  const int failures_before = kitbag_test::g_failures;
  if (kb_engine_create(&tuning_test::g_engine) != KB_OK) {
    std::fprintf(stderr, "tuner_verify: could not create an engine\n");
    return -1;
  }
  tuning_test::RunDetectTests();
  tuning_test::RunTimingTests();
  tuning_test::RunWindowTests();
  tuning_test::RunStabilityTests();
  tuning_test::RunSilenceTests();
  tuning_test::RunWrongStringTests();
  tuning_test::RunModeTests();
  tuning_test::RunEdgeTests();
  tuning_test::RunCounterTests();
  kb_engine_destroy(tuning_test::g_engine);
  const int checks = kitbag_test::g_checks - checks_before;
  std::printf(
      "tuning mode: %d of %d checks failed\n",
      kitbag_test::g_failures - failures_before,
      checks
  );
  return checks;
}

}  // namespace

int main() {
  TestReferenceTones();
  TestBassB0Settle();
  TestOctaveErrorKill();
  TestSilenceGate();
  TestA4Reference();
  if (RunTuningModeTests() < 0) return 1;
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "tuner_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("tuner_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "tuner_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
