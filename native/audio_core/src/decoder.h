#ifndef KITBAG_DECODER_H
#define KITBAG_DECODER_H

#include <atomic>
#include <cstdint>
#include <string>
#include <vector>

// miniaudio's type — third-party, its own naming convention.
struct ma_decoder;  // NOLINT(readability-identifier-naming)

namespace kitbag {

struct DecoderInfo {
  double duration_seconds = 0.0;
  uint32_t sample_rate = 0;
  uint32_t channels = 0;
  uint64_t total_frames = 0;
};

class Decoder {
 public:
  Decoder();
  ~Decoder();
  Decoder(const Decoder&) = delete;
  Decoder& operator=(const Decoder&) = delete;

  /// Opens an audio file and reads its metadata (no PCM decode yet).
  /// Returns true on success.
  bool Open(const char* path);

  /// Reads all PCM frames into memory. Must call Open() first.
  /// Returns a float interleaved buffer plus the actual frame count.
  std::vector<float> DecodeAll(uint64_t* out_frames);

  /// Closes the current file and frees resources.
  void Close();

  /// Returns the info from the last Open() call.
  DecoderInfo info() const { return info_; }

  /// True when a file is currently open.
  bool is_open() const { return is_open_.load(); }

 private:
  std::atomic<bool> is_open_{false};
  DecoderInfo info_;
  ma_decoder* decoder_ = nullptr;
};

}  // namespace kitbag

#endif  // KITBAG_DECODER_H
