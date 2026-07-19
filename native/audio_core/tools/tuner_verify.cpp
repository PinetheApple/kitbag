// Offline pitch verification: feeds synthesized reference tones through the
// PitchAnalyzer and asserts the M2 proof — ≤±1 cent across 82Hz–1kHz — plus
// settle time, octave-error rejection, and the silence gate.
#include <cmath>
#include <cstdio>
#include <cstdlib>

#include "../src/pitch_analyzer.h"

namespace {

constexpr double kSampleRate = 48000.0;
constexpr double kTau = 6.283185307179586;
constexpr double kToneAmplitude = 0.5;
constexpr double kA4Hz = 440.0;

constexpr double kMaxCentsError = 1.0;
// PLAN §3: settle <150ms. Bass B0 needs a ~90ms window, so it gets a looser
// "acceptable settle" budget per the M2 proof.
constexpr double kMaxSettleSeconds = 0.150;
constexpr double kMaxBassSettleSeconds = 0.400;
constexpr double kSettleToleranceCents = 2.0;
constexpr double kToneSeconds = 1.0;

// Reference tones spanning the M2 proof range (guitar low E to 1kHz).
constexpr double kReferenceTonesHz[] = {82.41,  110.0,  146.83, 196.0,
                                        246.94, 329.63, 440.0,  523.25,
                                        659.26, 880.0,  1000.0};

int g_failures = 0;

void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

double CentsBetween(double measured_hz, double true_hz) {
  return 1200.0 * std::log2(measured_hz / true_hz);
}

// Feeds a tone (fundamental + optional harmonics) and returns the time in
// seconds after which the reading stayed within tolerance of true_hz.
double FeedToneAndMeasureSettle(kitbag::PitchAnalyzer& analyzer, double true_hz,
                                double seconds, double harmonic2 = 0.0,
                                double harmonic3 = 0.0) {
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

void TestReferenceTones() {
  std::printf("reference tones (chromatic band, ±%.1f cent):\n",
              kMaxCentsError);
  for (const double tone_hz : kReferenceTonesHz) {
    kitbag::PitchAnalyzer analyzer(kSampleRate,
                                   kitbag::PitchAnalyzer::kChromaticLowHz,
                                   kitbag::PitchAnalyzer::kChromaticHighHz);
    const double settle =
        FeedToneAndMeasureSettle(analyzer, tone_hz, kToneSeconds);
    const auto& reading = analyzer.reading();
    const double error_cents = reading.pitch_hz > 0.0
                                   ? CentsBetween(reading.pitch_hz, tone_hz)
                                   : 999.0;
    std::printf(
        "  %8.2f Hz -> %8.3f Hz  err %+7.3f cents  settle %3.0f ms  "
        "conf %.2f\n",
        tone_hz, reading.pitch_hz, error_cents, settle * 1000.0,
        reading.confidence);
    Check(std::fabs(error_cents) <= kMaxCentsError,
          "reference tone within ±1 cent");
    Check(settle <= kMaxSettleSeconds, "settle under 150ms");
    Check(reading.note_index == kitbag::NoteIndexForFrequency(tone_hz, kA4Hz),
          "nearest note index matches");
  }
}

void TestBassB0Settle() {
  // 5-string bass low B through its preset string band (how the app reaches
  // notes below A1). The ~65ms two-period window plus smoothing gives it a
  // looser "acceptable settle" budget per the M2 proof.
  constexpr double kB0Hz = 30.87;
  constexpr double kBandSemitones = 5.0;
  kitbag::PitchAnalyzer analyzer(kSampleRate,
                                 kB0Hz * std::exp2(-kBandSemitones / 12.0),
                                 kB0Hz * std::exp2(kBandSemitones / 12.0));
  const double settle = FeedToneAndMeasureSettle(analyzer, kB0Hz, 2.0);
  const auto& reading = analyzer.reading();
  const double error_cents =
      reading.pitch_hz > 0.0 ? CentsBetween(reading.pitch_hz, kB0Hz) : 999.0;
  std::printf("bass B0: %.2f Hz -> %.3f Hz  err %+.3f cents  settle %.0f ms\n",
              kB0Hz, reading.pitch_hz, error_cents, settle * 1000.0);
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
  std::printf("octave kill: E2 + harmonics -> %.3f Hz  err %+.3f cents\n",
              reading.pitch_hz, error_cents);
  Check(std::fabs(error_cents) <= kMaxCentsError,
        "harmonic-rich E2 stays on the fundamental");
}

void TestSilenceGate() {
  kitbag::PitchAnalyzer analyzer(kSampleRate,
                                 kitbag::PitchAnalyzer::kChromaticLowHz,
                                 kitbag::PitchAnalyzer::kChromaticHighHz);
  for (int i = 0; i < static_cast<int>(kSampleRate / 2); ++i) {
    analyzer.Process(0.0f);
  }
  Check(analyzer.reading().pitch_hz == 0.0, "silence reports no pitch");
  Check(analyzer.reading().note_index == -1, "silence reports no note");
}

void TestA4Reference() {
  // 415Hz tone with A4=415 must read as A4 (MIDI 69), 0 cents.
  constexpr double kBaroqueA4Hz = 415.0;
  kitbag::PitchAnalyzer analyzer(kSampleRate,
                                 kitbag::PitchAnalyzer::kChromaticLowHz,
                                 kitbag::PitchAnalyzer::kChromaticHighHz);
  analyzer.SetA4(kBaroqueA4Hz);
  FeedToneAndMeasureSettle(analyzer, kBaroqueA4Hz, kToneSeconds);
  const auto& reading = analyzer.reading();
  std::printf("A4=415: note %d  cents %+.3f\n", reading.note_index,
              reading.cents);
  Check(reading.note_index == 69, "415Hz reads as A4 when A4=415");
  Check(std::fabs(reading.cents) <= kMaxCentsError, "415Hz reads as 0 cents");
}

}  // namespace

int main() {
  TestReferenceTones();
  TestBassB0Settle();
  TestOctaveErrorKill();
  TestSilenceGate();
  TestA4Reference();
  if (g_failures == 0) {
    std::printf("tuner_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "tuner_verify: %d failure(s)\n", g_failures);
  return 1;
}
