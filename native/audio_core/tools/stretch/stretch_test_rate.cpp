#include <cmath>
#include <cstdio>

#include "stretch_test_support.h"

namespace stretch_test {
namespace {

constexpr int kDurationToleranceFrames = kBlockFrames;
// Odd, so the tone edges line up with no block or STFT interval boundary.
constexpr int kUnalignedToneFrames = 70001;
constexpr Burst kBurst{
    .lead_frames = kSampleRate / 2,
    .tone_frames = kUnalignedToneFrames,
    .tail_frames = kSampleRate,
};

void CheckDurationAtRate(double rate, const char* label) {
  kitbag::TimeStretch stretch;
  stretch.Configure(kChannels, kSampleRate);
  const Span span = ToneSpan(Render(stretch, ToneBurst(kBurst, kToneHz), rate));
  const double expected = kBurst.tone_frames / rate;
  const int measured = span.last - span.first;
  std::printf(
      "stretch_verify: rate %.2f tone %d frames, expected %.0f\n",
      rate,
      measured,
      expected
  );
  Check(
      span.found && std::fabs(measured - expected) <= kDurationToleranceFrames,
      label
  );
}

}  // namespace

void RunRateTests() {
  CheckDurationAtRate(0.5, "rate 0.5: a tone lasts twice as long");
  CheckDurationAtRate(0.75, "rate 0.75: a tone lasts 1/0.75 as long");
  CheckDurationAtRate(1.0, "rate 1.0: a tone keeps its length");
}

}  // namespace stretch_test
