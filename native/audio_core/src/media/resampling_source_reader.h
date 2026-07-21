#ifndef KITBAG_MEDIA_RESAMPLING_SOURCE_READER_H
#define KITBAG_MEDIA_RESAMPLING_SOURCE_READER_H

#include <cstdint>
#include <memory>

#include "media/audio_source.h"

namespace kitbag {

// SourceReader decorator that converts an inner reader's audio to a target
// sample rate. It runs entirely on AudioSource's read-ahead thread — every
// call arrives from RefillOnce, never the audio callback — so the ring behind
// the callback already holds engine-rate frames and Read() stays untouched
// (SPEC.md §4.1, design-audit F4). Channel count is passed through unchanged;
// SPEC states no channel-conversion policy, so this only resamples.
//
// Pimpl over miniaudio's ma_data_converter (built-in linear resampler): keeps
// miniaudio out of this header, so the mixer and AudioSource seams stay
// decoder-agnostic.
class ResamplingSourceReader : public SourceReader {
 public:
  ResamplingSourceReader(SourceReader* inner, uint32_t out_rate);
  ~ResamplingSourceReader() override;
  ResamplingSourceReader(const ResamplingSourceReader&) = delete;
  ResamplingSourceReader& operator=(const ResamplingSourceReader&) = delete;

  // False if the converter failed to initialise; the track must be rejected.
  bool ok() const;

  uint32_t channels() const override;
  uint32_t sample_rate() const override;  // the target rate
  // Frames after resampling. ReadFrames delivers <= this: the linear converter
  // holds ~1 tail frame it cannot interpolate, so the last ~1 frame is zero-
  // filled (~40us, harmless). Not an exact delivered count.
  uint64_t total_frames() const override;
  ReadResult ReadFrames(float* dst, uint64_t frames) override;
  bool SeekToFrame(uint64_t frame) override;  // frame at the target rate

 private:
  struct Impl;
  std::unique_ptr<Impl> impl_;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_RESAMPLING_SOURCE_READER_H
