#include "analysis/waveform_peaks.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>

namespace kitbag {

namespace {

// Full-scale for signed 16-bit PCM, scaling float samples in [-1, 1].
constexpr float kInt16Max = 32767.0f;
constexpr uint32_t kKwavVersion = 1;
constexpr size_t kMagicBytes = 4;
constexpr char kMagic[] = "KWAV";

struct FileCloser {
  void operator()(std::FILE* f) const {
    std::fclose(f);
  }
};

long RemainingBytes(std::FILE* f) {
  const long here = std::ftell(f);
  if (here < 0 || std::fseek(f, 0, SEEK_END) != 0) return -1;
  const long end = std::ftell(f);
  if (end < 0 || std::fseek(f, here, SEEK_SET) != 0) return -1;
  return end - here;
}

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
  bool ok = std::fwrite(kMagic, 1, kMagicBytes, f) == kMagicBytes;
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

namespace {

struct KwavHeader {
  uint32_t channels = 0;
  int64_t total_frames = 0;
  uint32_t chunks = 0;
};

bool ReadKwavHeader(std::FILE* f, KwavHeader* header) {
  char magic[kMagicBytes];
  uint32_t version = 0;
  bool ok = std::fread(magic, 1, kMagicBytes, f) == kMagicBytes &&
            std::memcmp(magic, kMagic, kMagicBytes) == 0;
  ok = ok && std::fread(&version, sizeof(version), 1, f) == 1 &&
       version == kKwavVersion;
  ok = ok && std::fread(&header->channels, sizeof(header->channels), 1, f) == 1;
  ok = ok &&
       std::fread(&header->total_frames, sizeof(header->total_frames), 1, f) ==
           1;
  ok = ok && std::fread(&header->chunks, sizeof(header->chunks), 1, f) == 1;
  return ok && header->channels > 0 && header->chunks > 0;
}

int LoudestPeak(const WaveformPeaks& peaks, int64_t first, int64_t last) {
  const size_t stride =
      static_cast<size_t>(peaks.channels) * kPeakValuesPerChannel;
  const auto begin = static_cast<size_t>(first) * stride;
  const auto end = static_cast<size_t>(last) * stride;
  int loudest = 0;
  for (size_t i = begin; i < end && i < peaks.data.size(); ++i) {
    loudest = std::max(loudest, std::abs(static_cast<int>(peaks.data[i])));
  }
  return loudest;
}

}  // namespace

bool ReadKwav(const char* path, WaveformPeaks* out) {
  const std::unique_ptr<std::FILE, FileCloser> f(std::fopen(path, "rb"));
  KwavHeader header;
  if (!f || !ReadKwavHeader(f.get(), &header)) return false;
  const size_t values = static_cast<size_t>(header.chunks) * header.channels *
                        kPeakValuesPerChannel;
  // Checked before allocating, so a corrupt header cannot request a huge buffer.
  if (RemainingBytes(f.get()) != static_cast<long>(values * sizeof(int16_t))) {
    return false;
  }
  out->data.resize(values);
  if (std::fread(out->data.data(), sizeof(int16_t), values, f.get()) !=
      values) {
    return false;
  }
  out->channels = static_cast<int>(header.channels);
  out->chunk_count = static_cast<int>(header.chunks);
  out->total_frames = header.total_frames;
  return true;
}

void PeakEnvelope(const WaveformPeaks& peaks, float* out, int buckets) {
  const int64_t chunks = peaks.chunk_count;
  for (int b = 0; b < buckets; ++b) {
    const int64_t first = b * chunks / buckets;
    const int64_t last = std::max(first + 1, (b + 1) * chunks / buckets);
    const int loudest = LoudestPeak(peaks, first, last);
    out[b] = std::min(1.0f, static_cast<float>(loudest) / kInt16Max);
  }
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
