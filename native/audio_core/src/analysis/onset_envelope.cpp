#include "analysis/onset_envelope.h"

#include <algorithm>
#include <cmath>
#include <utility>

#include "analysis/block_fill.h"
#include "dsp/fft.h"

namespace kitbag {

namespace {

constexpr int kNumBins = kOnsetFftSize / 2 + 1;

void Magnitudes(const std::vector<float>& fft_buf, std::vector<float>& out) {
  for (size_t i = 0; i < out.size(); ++i) {
    const float re = fft_buf[2 * i];
    const float im = fft_buf[2 * i + 1];
    out[i] = std::sqrt(re * re + im * im);
  }
}

float SpectralFlux(
    const std::vector<float>& mag,
    const std::vector<float>& prev_mag
) {
  float flux = 0.0f;
  for (size_t i = 0; i < mag.size(); ++i) {
    const float diff = mag[i] - prev_mag[i];
    if (diff > 0.0f) {
      flux += diff;
    }
  }
  return flux / static_cast<float>(mag.size());
}

}  // namespace

OnsetEnvelope::OnsetEnvelope()
    : window_(kOnsetFftSize),
      frame_(kOnsetFftSize),
      fft_buf_(2 * kOnsetFftSize),
      mag_(kNumBins),
      prev_mag_(kNumBins, 0.0f) {
  fft_hann(window_.data(), kOnsetFftSize);
}

void OnsetEnvelope::Push(const float* mono, size_t count) {
  filled_ = FillBlock(mono, count, frame_, filled_, [this] {
    AnalyzeFrame();
    std::copy(frame_.begin() + kOnsetHopSize, frame_.end(), frame_.begin());
    return frame_.size() - kOnsetHopSize;
  });
}

std::vector<float> OnsetEnvelope::TakeFlux() {
  return std::exchange(flux_, {});
}

void OnsetEnvelope::AnalyzeFrame() {
  for (int i = 0; i < kOnsetFftSize; ++i) {
    fft_buf_[2 * i] = frame_[i] * window_[i];
    fft_buf_[2 * i + 1] = 0.0f;
  }
  fft(fft_buf_.data(), kOnsetFftSize, false);
  Magnitudes(fft_buf_, mag_);
  flux_.push_back(SpectralFlux(mag_, prev_mag_));
  std::swap(prev_mag_, mag_);
}

}  // namespace kitbag
