#ifndef KITBAG_TOOLS_ANALYSIS_ANALYZE_BUFFER_DRIVER_H
#define KITBAG_TOOLS_ANALYSIS_ANALYZE_BUFFER_DRIVER_H

// Drives the streaming analysers over a buffer already in memory: the suite's
// fixtures are synthesised, and the NaN path cannot be reached through a WAV.
#include "kitbag_api.h"

#include <algorithm>
#include <cstdint>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/downbeat.h"
#include "analysis/song_analysis.h"
#include "analysis/waveform_peaks.h"
#include "media/audio_source.h"
#include "media/decoder.h"

namespace analyze_test {

// Reports `info` verbatim, so channels==0 reaches the pipeline's own guard.
class BufferReader : public kitbag::SourceReader {
 public:
  BufferReader(
      const float* pcm,
      uint64_t frames,
      const kitbag::DecoderInfo& info
  )
      : pcm_(pcm), frames_(frames), info_(info) {}

  uint32_t channels() const override {
    return info_.channels;
  }
  uint32_t sample_rate() const override {
    return info_.sample_rate;
  }
  uint64_t total_frames() const override {
    return frames_;
  }

  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    const uint64_t n = std::min(frames, frames_ - position_);
    const uint64_t ch = info_.channels;
    std::copy(pcm_ + position_ * ch, pcm_ + (position_ + n) * ch, dst);
    position_ += n;
    return {
        n,
        n == frames ? kitbag::ReadStatus::kOk : kitbag::ReadStatus::kEndOfStream
    };
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > frames_) return false;
    position_ = frame;
    return true;
  }

 private:
  const float* pcm_;
  uint64_t frames_;
  kitbag::DecoderInfo info_;
  uint64_t position_ = 0;
};

inline kb_result AnalyzeDecodedPcm(
    const float* pcm,
    uint64_t frames,
    const kitbag::DecoderInfo& info,
    const char* path,
    const char* waveform_dir,
    kitbag::BeatResult* out
) {
  BufferReader reader(pcm, frames, info);
  return kitbag::AnalyzeSong(reader, path, waveform_dir, out);
}

inline kitbag::WaveformPeaks ComputeWaveformPeaks(
    const float* pcm,
    int frames,
    int channels,
    int target_chunks
) {
  kitbag::WaveformPeakAccumulator peaks(frames, channels, target_chunks);
  peaks.Push(pcm, static_cast<size_t>(frames));
  return peaks.peaks();
}

inline std::vector<int> FindDownbeats(
    const float* mono,
    int frames,
    int sample_rate,
    const std::vector<float>& beat_times,
    int beats_per_bar
) {
  kitbag::DownbeatTracker
      tracker(sample_rate, beat_times, frames, beats_per_bar);
  tracker.Push(mono, static_cast<size_t>(frames));
  return tracker.Finish();
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_ANALYZE_BUFFER_DRIVER_H
