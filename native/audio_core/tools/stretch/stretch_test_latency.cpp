#include <cmath>
#include <cstdio>

#include "stretch_test_support.h"

namespace stretch_test {
namespace {

// Measured worst 86 frames; the envelope resolves onsets to kEnvelopeFrames.
constexpr int kOnsetToleranceFrames = 2 * kEnvelopeFrames;
// Odd, so the onset lines up with no block or STFT interval boundary.
constexpr int kUnalignedLeadFrames = 30011;
constexpr Burst kBurst{
    .lead_frames = kUnalignedLeadFrames,
    .tone_frames = kSampleRate,
    .tail_frames = kSampleRate,
};

void CheckOnsetAtRate(double rate, const char* label) {
  kitbag::TimeStretch stretch;
  stretch.Configure(kChannels, kSampleRate);
  const Span span = ToneSpan(Render(stretch, ToneBurst(kBurst, kToneHz), rate));
  const int lag = stretch.SongLagFrames(rate);
  const double expected = (kBurst.lead_frames + lag) / rate;
  std::printf(
      "stretch_verify: rate %.2f onset at %d, expected %.0f (lag %d)\n",
      rate,
      span.first,
      expected,
      lag
  );
  Check(
      span.found && lag > 0 &&
          std::fabs(span.first - expected) <= kOnsetToleranceFrames,
      label
  );
}

}  // namespace

void RunLatencyTests() {
  CheckOnsetAtRate(1.0, "rate 1.0: onset lands where SongLagFrames says");
  CheckOnsetAtRate(0.5, "rate 0.5: onset lands where SongLagFrames says");
}

}  // namespace stretch_test
