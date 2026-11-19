#ifndef KITBAG_MEDIA_MONO_FILE_STREAM_H
#define KITBAG_MEDIA_MONO_FILE_STREAM_H

#include <cstdint>
#include <memory>
#include <vector>

#include "media/file_audio_reader.h"
#include "media/resampling_source_reader.h"

namespace kitbag {

// A file decoded, resampled and averaged to mono a chunk at a time. Offline:
// it blocks on the disk and allocates once, in Open.
class MonoFileStream {
 public:
  static constexpr uint32_t kChunkFrames = 4096;

  // False when the file will not decode or the converter will not start.
  bool Open(const char* path, uint32_t rate);
  // Up to kChunkFrames frames into `mono`; 0 once the file is exhausted.
  uint32_t Read(float* mono, uint32_t frames);

 private:
  FileAudioReader file_;
  std::unique_ptr<ResamplingSourceReader> resampler_;
  SourceReader* source_ = nullptr;
  std::vector<float> interleaved_;
  bool ended_ = false;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_MONO_FILE_STREAM_H
