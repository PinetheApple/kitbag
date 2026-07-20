#ifndef KITBAG_MEDIA_FILE_AUDIO_READER_H
#define KITBAG_MEDIA_FILE_AUDIO_READER_H

#include "media/audio_source.h"

// miniaudio's type — third-party, its own naming convention.
struct ma_decoder;  // NOLINT(readability-identifier-naming)

namespace kitbag {

// SourceReader over a file on disk, via miniaudio. Blocking I/O by design:
// every call arrives on AudioSource's read-ahead thread.
class FileAudioReader : public SourceReader {
 public:
  FileAudioReader() = default;
  ~FileAudioReader() override;
  FileAudioReader(const FileAudioReader&) = delete;
  FileAudioReader& operator=(const FileAudioReader&) = delete;

  // App thread, before the source starts. Returns false if the file cannot be
  // decoded.
  bool Open(const char* path);
  void Close();

  uint32_t channels() const override {
    return channels_;
  }
  uint32_t sample_rate() const override {
    return sample_rate_;
  }
  uint64_t total_frames() const override {
    return total_frames_;
  }

  ReadResult ReadFrames(float* dst, uint64_t frames) override;
  bool SeekToFrame(uint64_t frame) override;

 private:
  ma_decoder* decoder_ = nullptr;
  uint32_t channels_ = 0;
  uint32_t sample_rate_ = 0;
  uint64_t total_frames_ = 0;
};

}  // namespace kitbag

#endif  // KITBAG_MEDIA_FILE_AUDIO_READER_H
