#ifndef KITBAG_MEDIA_MONO_FILE_STREAM_H
#define KITBAG_MEDIA_MONO_FILE_STREAM_H

#include <cstdint>
#include <memory>
#include <vector>

#include "media/file_audio_reader.h"
#include "media/resampling_source_reader.h"

namespace kitbag {

// Offline: it blocks on the disk and allocates once, in Open.
class MonoFileStream {
 public:
  static constexpr uint32_t kChunkFrames = 4096;

  bool Open(const char* path, uint32_t rate);
  // `source` must outlive the stream.
  bool Open(SourceReader* source, uint32_t rate);
  // Up to kChunkFrames frames into `mono`; 0 once the source is exhausted.
  uint32_t Read(float* mono, uint32_t frames);
  // After Read returns 0: the source stopped short of its stated length.
  bool failed() const {
    return failed_;
  }

 private:
  class CountingReader : public SourceReader {
   public:
    SourceReader* inner = nullptr;
    uint64_t frames = 0;
    bool blocked = false;

    uint32_t channels() const override;
    uint32_t sample_rate() const override;
    uint64_t total_frames() const override;
    ReadResult ReadFrames(float* dst, uint64_t frames) override;
    bool SeekToFrame(uint64_t frame) override;
  };

  void Finish();

  FileAudioReader file_;
  CountingReader counted_;
  std::unique_ptr<ResamplingSourceReader> resampler_;
  SourceReader* source_ = nullptr;
  std::vector<float> interleaved_;
  bool ended_ = false;
  bool failed_ = false;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_MONO_FILE_STREAM_H
