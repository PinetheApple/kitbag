#include "analysis/waveform_peaks.h"

#include <algorithm>
#include <cmath>

namespace kitbag {

namespace {

// Full-scale for signed 16-bit PCM, scaling float samples in [-1, 1].
constexpr float kInt16Max = 32767.0f;

// A malformed file can decode to NaN, +/-inf or values far outside [-1, 1]
// (measured up to 3.19e38). float->int16 of any of those is undefined
// behaviour, so map non-finite to 0 and clamp before the cast — deterministic.
int16_t Quantize(float value) {
  if (!std::isfinite(value)) return 0;
  return static_cast<int16_t>(std::clamp(value, -1.0f, 1.0f) * kInt16Max);
}

}  // namespace

WaveformPeakAccumulator::WaveformPeakAccumulator(
    int64_t total_frames,
    int channels,
    int target_chunks
) {
  if (total_frames <= 0 || channels <= 0 || target_chunks <= 0) return;
  chunk_size_ = std::max<int64_t>(1, total_frames / target_chunks);
  peaks_.channels = channels;
  peaks_.chunk_count = static_cast<int>(total_frames / chunk_size_);
  peaks_.total_frames = total_frames;
  peaks_.data.resize(static_cast<size_t>(peaks_.chunk_count) * channels * 2);
  min_.resize(channels);
  max_.resize(channels);
  ResetSpan();
}

// NaN compares false both ways, so it never displaces a min or max.
void WaveformPeakAccumulator::Push(const float* interleaved, size_t frames) {
  const auto channels = static_cast<size_t>(peaks_.channels);
  for (size_t f = 0; f < frames && chunk_ < peaks_.chunk_count; ++f) {
    for (size_t ch = 0; ch < channels; ++ch) {
      const float v = interleaved[f * channels + ch];
      if (v < min_[ch]) min_[ch] = v;
      if (v > max_[ch]) max_[ch] = v;
    }
    if (++span_filled_ == chunk_size_) CloseSpan();
  }
}

void WaveformPeakAccumulator::ResetSpan() {
  std::fill(min_.begin(), min_.end(), 1.0f);
  std::fill(max_.begin(), max_.end(), -1.0f);
  span_filled_ = 0;
}

void WaveformPeakAccumulator::CloseSpan() {
  int16_t* out =
      &peaks_.data[static_cast<size_t>(chunk_) * peaks_.channels * 2];
  for (int ch = 0; ch < peaks_.channels; ++ch) {
    out[ch * 2] = Quantize(min_[ch]);
    out[ch * 2 + 1] = Quantize(max_[ch]);
  }
  ++chunk_;
  ResetSpan();
}

}  // namespace kitbag
