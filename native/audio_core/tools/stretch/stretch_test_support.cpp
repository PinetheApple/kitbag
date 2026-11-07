#include "stretch_test_support.h"

#include <algorithm>
#include <cmath>
#include <numbers>

#include "tuner/pitch_detector.h"

namespace stretch_test {
namespace {

constexpr float kOnsetFraction = 0.5f;
constexpr int kDetectorFrames = 4096;
constexpr double kMinDetectHz = 100.0;
constexpr double kMaxDetectHz = 1000.0;

float WindowPeak(const std::vector<float>& signal, int first) {
  float peak = 0.0f;
  for (int i = first; i < first + kEnvelopeFrames; ++i) {
    peak = std::max(peak, std::fabs(signal[i * kChannels]));
  }
  return peak;
}

float PartialSum(double phase, int partials) {
  double sum = 0.0;
  for (int h = 1; h <= partials; ++h) sum += std::sin(phase * h) / h;
  return static_cast<float>(sum);
}

}  // namespace

std::vector<float> ToneBurst(const Burst& burst, double hz) {
  const int total = burst.lead_frames + burst.tone_frames + burst.tail_frames;
  std::vector<float> out(static_cast<std::size_t>(total) * kChannels, 0.0f);
  const double step = 2.0 * std::numbers::pi * hz / kSampleRate;
  for (int i = 0; i < burst.tone_frames; ++i) {
    const auto value = kAmplitude * PartialSum(step * i, burst.partials);
    for (int c = 0; c < kChannels; ++c) {
      out[(burst.lead_frames + i) * kChannels + c] = value;
    }
  }
  return out;
}

std::vector<float> Render(
    kitbag::TimeStretch& stretch,
    const std::vector<float>& in,
    double rate
) {
  const int in_total = static_cast<int>(in.size()) / kChannels;
  std::vector<float> out;
  std::vector<float> block(kBlockFrames * kChannels);
  InputStepper stepper(rate, kBlockFrames);
  int pos = 0;
  for (int take = stepper.Next(); pos + take <= in_total;
       take = stepper.Next()) {
    stretch.Process(&in[pos * kChannels], take, block.data(), kBlockFrames);
    out.insert(out.end(), block.begin(), block.end());
    pos += take;
  }
  return out;
}

Span ToneSpan(const std::vector<float>& signal) {
  const int frames = static_cast<int>(signal.size()) / kChannels;
  Span span;
  for (int w = 0; w + kEnvelopeFrames <= frames; w += kEnvelopeFrames) {
    if (WindowPeak(signal, w) < kAmplitude * kOnsetFraction) continue;
    if (!span.found) span.first = w;
    span.found = true;
    span.last = w + kEnvelopeFrames;
  }
  return span;
}

double MeasuredHz(const std::vector<float>& signal, int from, int to) {
  kitbag::PitchDetector detector;
  detector.Init(kDetectorFrames, kSampleRate);
  std::vector<float> frame(kDetectorFrames);
  std::vector<double> estimates;
  for (int start = from; start + kDetectorFrames <= to;
       start += kDetectorFrames) {
    for (int i = 0; i < kDetectorFrames; ++i) {
      frame[i] = signal[(start + i) * kChannels];
    }
    const auto estimate =
        detector.Detect(frame.data(), kMinDetectHz, kMaxDetectHz, false);
    if (estimate.hz > 0.0) estimates.push_back(estimate.hz);
  }
  if (estimates.empty()) return 0.0;
  std::sort(estimates.begin(), estimates.end());
  return estimates[estimates.size() / 2];
}

double CentsBetween(double measured_hz, double true_hz) {
  constexpr double kCentsPerOctave = 1200.0;
  return kCentsPerOctave * std::log2(measured_hz / true_hz);
}

}  // namespace stretch_test
