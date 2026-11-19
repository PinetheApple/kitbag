#ifndef KITBAG_MIXDOWN_WAV_WRITER_H
#define KITBAG_MIXDOWN_WAV_WRITER_H

#include "kitbag_api.h"

#include <climits>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#include "media/part_file.h"
#include "media/riff_bytes.h"

namespace kitbag {

class WavWriter {
 public:
  static constexpr uint32_t kChannels = KB_MIXDOWN_CHANNELS;
  static constexpr uint32_t kBitsPerSample = KB_MIXDOWN_BITS_PER_SAMPLE;
  static_assert(kBitsPerSample == sizeof(int16_t) * CHAR_BIT);
  static constexpr uint32_t kBytesPerFrame = kChannels * sizeof(int16_t);
  static constexpr uint32_t kHeaderBytes = riff::kHeaderBytes;
  static constexpr const char* kPartSuffix = kitbag::kPartSuffix;

  static uint64_t FileBytes(uint64_t frames) {
    return kHeaderBytes + frames * kBytesPerFrame;
  }
  static uint64_t MaxFrames();

  WavWriter() = default;
  ~WavWriter();
  WavWriter(const WavWriter&) = delete;
  WavWriter& operator=(const WavWriter&) = delete;

  bool Open(
      const std::string& path,
      uint32_t sample_rate,
      uint32_t max_block_frames
  );
  bool Write(const float* interleaved, uint32_t frames);
  bool Finish();
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
