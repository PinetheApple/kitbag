#ifndef KITBAG_MIXDOWN_WAV_WRITER_H
#define KITBAG_MIXDOWN_WAV_WRITER_H

#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

namespace kitbag {

// Streams interleaved stereo float to a 16-bit PCM WAV. Writes to
// path + ".part" and renames on Finish, so a reader never sees a partial file.
class WavWriter {
 public:
  static constexpr uint32_t kChannels = 2;
  static constexpr uint32_t kBytesPerFrame = kChannels * sizeof(int16_t);
  static constexpr uint32_t kHeaderBytes = 44;
  static constexpr const char* kPartSuffix = ".part";

  static uint64_t FileBytes(uint64_t frames) {
    return kHeaderBytes + frames * kBytesPerFrame;
  }
  static uint64_t MaxFrames();
  static int16_t ToS16(float sample);

  WavWriter() = default;
  ~WavWriter();
  WavWriter(const WavWriter&) = delete;
  WavWriter& operator=(const WavWriter&) = delete;

  /// Sizes the conversion buffer for Write calls up to [max_block] frames.
  bool Open(const std::string& path, uint32_t sample_rate, uint32_t max_block);
  bool Write(const float* interleaved, uint32_t frames);
  /// Patches the sizes and renames; on failure the partial file is removed.
  bool Finish();
  /// Closes and removes the partial file. Safe when nothing is open.
  void Abort();
  uint64_t frames() const {
    return frames_;
  }

 private:
  bool WriteHeader(uint64_t frames);

  std::FILE* file_ = nullptr;
  std::string path_;
  std::string part_;
  uint32_t sample_rate_ = 0;
  uint64_t frames_ = 0;
  std::vector<uint8_t> bytes_;
};

}  // namespace kitbag

#endif  // KITBAG_MIXDOWN_WAV_WRITER_H
