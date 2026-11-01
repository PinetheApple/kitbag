#ifndef KITBAG_TOOLS_STRETCH_TEST_SUPPORT_H
#define KITBAG_TOOLS_STRETCH_TEST_SUPPORT_H

#include <cstddef>
#include <vector>

#include "check.h"
#include "input_stepper.h"
#include "stretch/time_stretch.h"

namespace stretch_test {

using kitbag_test::Check;

constexpr int kSampleRate = 48000;
constexpr int kChannels = 2;
constexpr int kBlockFrames = 480;
constexpr float kAmplitude = 0.5f;
constexpr double kToneHz = 293.0;
constexpr int kEnvelopeFrames = 96;

struct Burst {
  int lead_frames = 0;
  int tone_frames = 0;
  int tail_frames = 0;
  int partials = 1;
};

struct Span {
  bool found = false;
  int first = 0;
  int last = 0;
};

std::size_t AllocationCount();

std::vector<float> ToneBurst(const Burst& burst, double hz);
std::vector<float>
Render(kitbag::TimeStretch& stretch, const std::vector<float>& in, double rate);
Span ToneSpan(const std::vector<float>& signal);
double MeasuredHz(const std::vector<float>& signal, int from, int to);
double CentsBetween(double measured_hz, double true_hz);

void RunRateTests();
void RunPitchTests();
void RunLatencyTests();
void RunAllocationTests();

}  // namespace stretch_test

#endif  // KITBAG_TOOLS_STRETCH_TEST_SUPPORT_H
