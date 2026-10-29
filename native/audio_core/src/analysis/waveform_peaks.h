#ifndef KITBAG_ANALYSIS_WAVEFORM_PEAKS_H
#define KITBAG_ANALYSIS_WAVEFORM_PEAKS_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace kitbag {

inline constexpr int kPeakValuesPerChannel = 2;

struct WaveformPeaks {
  std::vector<int16_t> data;  // interleaved [ch0_min, ch0_max, ch1_min, ...]
  int channels = 0;
  int chunk_count = 0;
  int64_t total_frames = 0;
};

int16_t QuantizePeak(float value);

/// A partial file is removed.
bool WriteKwav(const char* path, const WaveformPeaks& peaks);

bool ReadKwav(const char* path, WaveformPeaks* out);

void PeakEnvelope(const WaveformPeaks& peaks, float* out, int buckets);

/// Per-channel min/max over `target_chunks` equal spans of `total_frames`,
/// pushed in pieces of any size; frames past the last whole span are ignored.
class WaveformPeakAccumulator {
 public:
  WaveformPeakAccumulator(
      int64_t total_frames,
      int channels,
      int target_chunks
  );

  void Push(const float* interleaved, size_t frames);

  /// Empty data for no frames, no channels or no target chunks.
  const WaveformPeaks& peaks() const {
    return peaks_;
  }

 private:
  void ResetSpan();
  void CloseSpan();

  WaveformPeaks peaks_;
  int64_t chunk_size_ = 1;
  int64_t span_filled_ = 0;
  int chunk_ = 0;
  std::vector<float> min_;
  std::vector<float> max_;
};

}  // namespace kitbag

#endif  // KITBAG_ANALYSIS_WAVEFORM_PEAKS_H
