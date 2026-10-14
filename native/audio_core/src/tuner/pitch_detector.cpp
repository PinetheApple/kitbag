#include "tuner/pitch_detector.h"

#include <algorithm>
#include <cmath>

#include "dsp/fft.h"

namespace kitbag {

namespace {

// McLeod's k: the first NSDF peak within this fraction of the highest wins, so
// a period's multiples, nearly as high, never beat the period itself.
constexpr double kPeakRatio = 0.9;
constexpr int kMinLag = 2;
// How far a folded period may sit from an exact power-of-two multiple.
constexpr double kFoldTolerance = 0.01;

}  // namespace

void PitchDetector::Init(int frame_size, double sample_rate) {
  frame_size_ = frame_size;
  sample_rate_ = sample_rate;
  spectrum_.assign(static_cast<size_t>(4 * frame_size), 0.0f);
  nsdf_.assign(static_cast<size_t>(frame_size / 2 + 2), 0.0);
}

PitchDetector::Estimate PitchDetector::Detect(
    const float* frame,
    double min_hz,
    double max_hz,
    bool fold_octaves
) {
  const int half = frame_size_ / 2;
  const int max_lag =
      std::min(half, static_cast<int>(std::floor(sample_rate_ / min_hz)));
  const int min_lag =
      std::max(kMinLag, static_cast<int>(std::ceil(sample_rate_ / max_hz)));
  if (frame_size_ == 0 || min_lag >= max_lag) return {};

  Autocorrelate(frame);
  Normalise(frame, max_lag);
  // McLeod over every lag first: the true period may be shorter than the
  // range allows, and the range would then only see one of its multiples.
  const int true_lag = PickPeak(kMinLag, max_lag);
  const int lag = true_lag >= min_lag ? true_lag : PickPeak(min_lag, max_lag);
  if (lag < 0) return {};
  const double period = RefinePeriod(frame, lag);
  if (lag != true_lag &&
      !(fold_octaves && IsOctaveFold(frame, true_lag, period))) {
    return {};
  }
  return {sample_rate_ / period, nsdf_[static_cast<size_t>(lag)]};
}

bool PitchDetector::IsOctaveFold(
    const float* frame,
    int above_lag,
    double period
) const {
  const double ratio = period / InterpolatedPeak(frame, above_lag);
  const double octaves = std::round(std::log2(ratio));
  return octaves >= 1.0 &&
         std::fabs(ratio / std::exp2(octaves) - 1.0) <= kFoldTolerance;
}

// Zero-padded to twice the frame, so the circular correlation is linear.
void PitchDetector::Autocorrelate(const float* frame) {
  std::fill(spectrum_.begin(), spectrum_.end(), 0.0f);
  for (int i = 0; i < frame_size_; ++i) spectrum_[2 * i] = frame[i];
  const int points = 2 * frame_size_;
  fft(spectrum_.data(), points, false);
  for (int i = 0; i < points; ++i) {
    const float re = spectrum_[2 * i];
    const float im = spectrum_[2 * i + 1];
    spectrum_[2 * i] = re * re + im * im;
    spectrum_[2 * i + 1] = 0.0f;
  }
  fft(spectrum_.data(), points, true);
}

void PitchDetector::Normalise(const float* frame, int max_lag) {
  double energy = 0.0;
  for (int i = 0; i < frame_size_; ++i) energy += frame[i] * frame[i];
  double m = 2.0 * energy;
  for (int lag = 0; lag <= max_lag + 1; ++lag) {
    const double r = spectrum_[2 * lag];
    nsdf_[static_cast<size_t>(lag)] = m > 0.0 ? 2.0 * r / m : 0.0;
    const double head = frame[lag];
    const double tail = frame[frame_size_ - 1 - lag];
    m -= head * head + tail * tail;
  }
}

// Local maxima only: a lag range that starts inside a falling lobe must not
// read the lobe's edge as a peak.
int PitchDetector::PickPeak(int min_lag, int max_lag) const {
  auto is_peak = [this](int lag) {
    const auto at = [this](int l) { return nsdf_[static_cast<size_t>(l)]; };
    return at(lag) > 0.0 && at(lag) > at(lag - 1) && at(lag) >= at(lag + 1);
  };
  double best = 0.0;
  for (int lag = min_lag; lag <= max_lag; ++lag) {
    if (is_peak(lag)) best = std::max(best, nsdf_[static_cast<size_t>(lag)]);
  }
  for (int lag = min_lag; lag <= max_lag; ++lag) {
    if (is_peak(lag) && nsdf_[static_cast<size_t>(lag)] >= kPeakRatio * best) {
      return lag;
    }
  }
  return -1;
}

// The same peak error spread over m periods: interpolating at the longest
// multiple that keeps half the frame overlapping divides it by m.
double PitchDetector::RefinePeriod(const float* frame, int lag) const {
  const double period = InterpolatedPeak(frame, lag);
  const int half = frame_size_ / 2;
  const int multiple = static_cast<int>(half / period);
  if (multiple < 2) return period;
  const int centre = static_cast<int>(std::lround(multiple * period));
  int best = centre;
  double best_value = ExactNsdf(frame, centre);
  for (int lag_at = centre - 2; lag_at <= centre + 2; ++lag_at) {
    const double value = ExactNsdf(frame, lag_at);
    if (value > best_value) {
      best = lag_at;
      best_value = value;
    }
  }
  const bool interior = best > centre - 2 && best < centre + 2;
  return interior ? InterpolatedPeak(frame, best) / multiple : period;
}

double PitchDetector::InterpolatedPeak(const float* frame, int lag) const {
  const double before = ExactNsdf(frame, lag - 1);
  const double at = ExactNsdf(frame, lag);
  const double after = ExactNsdf(frame, lag + 1);
  const double curvature = before - 2.0 * at + after;
  if (curvature >= 0.0) return lag;
  return lag + 0.5 * (before - after) / curvature;
}

double PitchDetector::ExactNsdf(const float* frame, int lag) const {
  double correlation = 0.0;
  double energy = 0.0;
  for (int i = 0; i + lag < frame_size_; ++i) {
    const double a = frame[i];
    const double b = frame[i + lag];
    correlation += a * b;
    energy += a * a + b * b;
  }
  return energy > 0.0 ? 2.0 * correlation / energy : 0.0;
}

}  // namespace kitbag
