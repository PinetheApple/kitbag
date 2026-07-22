#ifndef KITBAG_TOOLS_MEDIA_MEMORY_AUDIO_READER_H
#define KITBAG_TOOLS_MEDIA_MEMORY_AUDIO_READER_H

#include <atomic>
#include <cstdint>
#include <vector>

#include "media/audio_source.h"
#include "media_test_support.h"

namespace media_test {

// The second adapter behind the SourceReader seam: PCM already in memory, no
// file on disk. It is what proves the seam is real rather than a wrapper
// around miniaudio.
//
// `gate` is the deliberate extra: frames beyond it answer kWouldBlock instead
// of kEndOfStream, which is the only way to starve the ring on purpose and so
// the only way to make the underrun path testable at all.
class MemoryAudioReader : public kitbag::SourceReader {
 public:
  MemoryAudioReader(
      std::vector<float> samples,
      uint32_t channels,
      uint32_t sample_rate = kSampleRate
  )
      : samples_(std::move(samples)),
        channels_(channels),
        sample_rate_(sample_rate) {
    gate_.store(total_frames());
  }

  uint32_t channels() const override {
    return channels_;
  }
  uint32_t sample_rate() const override {
    return sample_rate_;
  }
  uint64_t total_frames() const override {
    return samples_.size() / channels_;
  }

  // Frames past this point answer kWouldBlock until the gate moves.
  void set_gate(uint64_t frames) {
    gate_.store(frames);
  }

  kitbag::ReadResult ReadFrames(float* dst, uint64_t frames) override {
    const uint64_t gate = gate_.load();
    const uint64_t limit = gate < total_frames() ? gate : total_frames();
    const uint64_t available = position_ < limit ? limit - position_ : 0;
    const uint64_t n = frames < available ? frames : available;
    for (uint64_t i = 0; i < n * channels_; ++i) {
      dst[i] = samples_[(position_ * channels_) + i];
    }
    position_ += n;
    if (n == frames) return {n, kitbag::ReadStatus::kOk};
    const bool blocked = gate < total_frames();
    return {
        n,
        blocked ? kitbag::ReadStatus::kWouldBlock
                : kitbag::ReadStatus::kEndOfStream
    };
  }

  bool SeekToFrame(uint64_t frame) override {
    if (frame > total_frames()) return false;
    position_ = frame;
    return true;
  }

 private:
  std::vector<float> samples_;
  uint32_t channels_;
  uint32_t sample_rate_;
  uint64_t position_ = 0;       // read-ahead thread only
  std::atomic<uint64_t> gate_;  // moved from the test thread
};

// Interleaved ramp whose every sample is its own absolute index, so a wrap
// off-by-one or a reordered span shows up as a wrong value, not a wrong count.
// `first` offsets the whole ramp: two sources built with different offsets
// share no sample value, which is what makes stale buffered audio visible.
inline std::vector<float>
RampSamples(uint64_t frames, uint32_t channels, uint64_t first = 0) {
  std::vector<float> samples(frames * channels);
  for (size_t i = 0; i < samples.size(); ++i) {
    samples[i] = static_cast<float>(first + i);
  }
  return samples;
}

}  // namespace media_test

#endif  // KITBAG_TOOLS_MEDIA_MEMORY_AUDIO_READER_H
