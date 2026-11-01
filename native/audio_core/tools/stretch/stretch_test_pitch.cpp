#include <cmath>
#include <cstdio>

#include "stretch_test_support.h"

namespace stretch_test {
namespace {

// Measured worst case 2.24 cents: six-partial tones at 110-440 Hz, shifts
// within +-6 st.
constexpr double kPitchToleranceCents = 3.0;
// A regression bound, not an accuracy claim: measured worst 8.6 cents on pure
// sines at 110-880 Hz.
constexpr double kPureSineToleranceCents = 10.0;
constexpr double kSemitonesPerOctave = 12.0;
constexpr int kSettleFrames = kSampleRate / 4;
constexpr int kPureSine = 1;
constexpr int kHarmonicPartials = 6;
constexpr double kLowToneHz = 147.0;
constexpr double kHighToneHz = 391.0;

struct Case {
  double hz;
  double rate;
  float semitones;
  int partials;
  double tolerance_cents;
};

void CheckPitch(const Case& c, const char* label) {
  kitbag::TimeStretch stretch;
  stretch.Configure(kChannels, kSampleRate);
  stretch.SetTransposeSemitones(c.semitones);
  const Burst burst{
      .lead_frames = kSampleRate / 4,
      .tone_frames = 2 * kSampleRate,
      .tail_frames = kSampleRate / 2,
      .partials = c.partials,
  };
  const auto out = Render(stretch, ToneBurst(burst, c.hz), c.rate);
  const Span span = ToneSpan(out);
  const double hz =
      MeasuredHz(out, span.first + kSettleFrames, span.last - kSettleFrames);
  const double target = c.hz * std::exp2(c.semitones / kSemitonesPerOctave);
  const double cents = hz > 0.0 ? CentsBetween(hz, target) : 0.0;
  std::printf(
      "stretch_verify: %.0f Hz x%d rate %.2f shift %+.0f st: %+.3f cents\n",
      c.hz,
      c.partials,
      c.rate,
      c.semitones,
      cents
  );
  Check(span.found && hz > 0.0 && std::fabs(cents) <= c.tolerance_cents, label);
}

void CheckShift(double hz, float semitones, int partials, const char* label) {
  const double tolerance =
      partials == kPureSine ? kPureSineToleranceCents : kPitchToleranceCents;
  CheckPitch(
      {.hz = hz,
       .rate = 1.0,
       .semitones = semitones,
       .partials = partials,
       .tolerance_cents = tolerance},
      label
  );
}

void CheckHarmonicShifts(double hz) {
  CheckShift(hz, 1.0f, kHarmonicPartials, "harmonic tone: +1 st lands");
  CheckShift(hz, -1.0f, kHarmonicPartials, "harmonic tone: -1 st lands");
  CheckShift(hz, 6.0f, kHarmonicPartials, "harmonic tone: +6 st lands");
  CheckShift(hz, -6.0f, kHarmonicPartials, "harmonic tone: -6 st lands");
}

void CheckPureSineShifts(double hz) {
  CheckShift(hz, 1.0f, kPureSine, "pure sine: +1 st within regression bound");
  CheckShift(hz, -1.0f, kPureSine, "pure sine: -1 st within regression bound");
  CheckShift(hz, 6.0f, kPureSine, "pure sine: +6 st within regression bound");
  CheckShift(hz, -6.0f, kPureSine, "pure sine: -6 st within regression bound");
}

void CheckRate(double rate, const char* label) {
  CheckPitch(
      {.hz = kToneHz,
       .rate = rate,
       .semitones = 0.0f,
       .partials = kPureSine,
       .tolerance_cents = kPitchToleranceCents},
      label
  );
}

}  // namespace

void RunPitchTests() {
  CheckRate(0.5, "rate 0.5: pitch holds");
  CheckRate(0.75, "rate 0.75: pitch holds");
  CheckHarmonicShifts(kLowToneHz);
  CheckHarmonicShifts(kHighToneHz);
  CheckPureSineShifts(kLowToneHz);
  CheckPureSineShifts(kHighToneHz);
}

}  // namespace stretch_test
