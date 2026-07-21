#ifndef KITBAG_MEDIA_PCM_SOURCE_READER_H
#define KITBAG_MEDIA_PCM_SOURCE_READER_H

#include <cstdint>
#include <vector>

#include "media/audio_source.h"

namespace kitbag {

// In-memory SourceReader over a caller-supplied PCM buffer, copied once at
// construction. The legacy path behind Mixer::SetTrackData: it still holds the
// whole song, so the O(tracks) win is only real for streaming readers. A bridge
// until kb_mixer_load_track streams from disk (A4, SPEC.md §4.1).
class PcmSourceReader : public SourceReader {
 public:
  PcmSourceReader(
      const float* pcm,
      uint64_t num_frames,
      uint32_t channels,
      uint32_t sample_rate
  )
      : samples_(pcm, pcm + num_frames * channels),
        channels_(channels),
        sample_rate_(sample_rate),
        total_frames_(num_frames) {}

  uint32_t channels() const override {
    return channels_;
  }
  uint32_t sample_rate() const override {
    return sample_rate_;
  }
  uint64_t total_frames() const override {
    return total_frames_;
  }

  ReadResult ReadFrames(float* dst, uint64_t frames) override {
    const uint64_t avail =
        position_ < total_frames_ ? total_frames_ - position_ : 0;
    const uint64_t n = frames < avail ? frames : avail;
    for (uint64_t i = 0; i < n * channels_; ++i) {
      dst[i] = samples_[(position_ * channels_) + i];
    }
    position_ += n;
    return {n, n == frames ? ReadStatus::kOk : ReadStatus::kEndOfStream};
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > total_frames_) return false;
    position_ = frame;
    return true;
  }

 private:
  std::vector<float> samples_;
  uint32_t channels_;
  uint32_t sample_rate_;
  uint64_t total_frames_;
  uint64_t position_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_PCM_SOURCE_READER_H
