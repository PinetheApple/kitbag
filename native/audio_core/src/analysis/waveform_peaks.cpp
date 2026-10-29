#include "analysis/waveform_peaks.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace kitbag {

namespace {

// Full-scale for signed 16-bit PCM, scaling float samples in [-1, 1].
constexpr float kInt16Max = 32767.0f;
constexpr uint32_t kKwavVersion = 1;

}  // namespace

// A malformed file can decode to NaN or up to 3.19e38 (measured), and
// float->int16 out of range is undefined behaviour.
int16_t QuantizePeak(float value) {
  if (!std::isfinite(value)) return 0;
  return static_cast<int16_t>(std::clamp(value, -1.0f, 1.0f) * kInt16Max);
}

// Layout: magic "KWAV" (4 bytes), version(uint32), channels(uint32),
// total_frames(int64), chunk_count(uint32), data(int16[]).
bool WriteKwav(const char* path, const WaveformPeaks& peaks) {
  std::FILE* f = std::fopen(path, "wb");
  if (f == nullptr) return false;
  const auto channels = static_cast<uint32_t>(peaks.channels);
  const int64_t total = peaks.total_frames;
  const auto chunks = static_cast<uint32_t>(peaks.chunk_count);
  bool ok = std::fwrite("KWAV", 1, 4, f) == 4;
  ok = ok && std::fwrite(&kKwavVersion, sizeof(kKwavVersion), 1, f) == 1;
  ok = ok && std::fwrite(&channels, sizeof(channels), 1, f) == 1;
  ok = ok && std::fwrite(&total, sizeof(total), 1, f) == 1;
  ok = ok && std::fwrite(&chunks, sizeof(chunks), 1, f) == 1;
  ok = ok &&
       std::fwrite(peaks.data.data(), sizeof(int16_t), peaks.data.size(), f) ==
           peaks.data.size();
  ok = std::fclose(f) == 0 && ok;
  if (!ok) std::remove(path);
  return ok;
}

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
  peaks_.data.resize(
      static_cast<size_t>(peaks_.chunk_count) * channels * kPeakValuesPerChannel
  );
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
  const size_t start =
      static_cast<size_t>(chunk_) * peaks_.channels * kPeakValuesPerChannel;
  int16_t* out = &peaks_.data[start];
  for (int ch = 0; ch < peaks_.channels; ++ch) {
    out[ch * kPeakValuesPerChannel] = QuantizePeak(min_[ch]);
    out[ch * kPeakValuesPerChannel + 1] = QuantizePeak(max_[ch]);
  }
  ++chunk_;
  ResetSpan();
}

}  // namespace kitbag
