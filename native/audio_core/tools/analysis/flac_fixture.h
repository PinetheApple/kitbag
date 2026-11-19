#ifndef KITBAG_TOOLS_ANALYSIS_FLAC_FIXTURE_H
#define KITBAG_TOOLS_ANALYSIS_FLAC_FIXTURE_H

#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "media/wav_fixture.h"

namespace analyze_test {

using media_test::kBitsPerByte;

constexpr uint32_t kFlacRate = 44100;
constexpr uint64_t kFlacBlockFrames = 4096;
constexpr int kFlacMaxSingleByteFrameIndex = 127;
constexpr uint32_t kFlacBitsPerSample = 16;
constexpr uint16_t kFlacConstantSample = 1000;
constexpr std::array<uint8_t, 4> kFlacMagic = {'f', 'L', 'a', 'C'};
constexpr uint8_t kFlacLastStreamInfoBlock = 0x80;
constexpr uint32_t kFlacStreamInfoBytes = 34;
constexpr size_t kFlacMd5Bytes = 16;
constexpr size_t kFlacFrameSizeBytes = 3;
constexpr int kFlacRateShift = 44;
constexpr int kFlacBitsShift = 36;
constexpr std::array<uint8_t, 2> kFlacFrameSync = {0xFF, 0xF8};
constexpr uint8_t kFlacBlockSizeCode4096 = 12;
constexpr uint8_t kFlacRateCode44k1 = 9;
constexpr uint8_t kFlacChannelsMono = 0;
constexpr uint8_t kFlacSampleSizeCode16 = 4;
constexpr int kFlacHighNibbleShift = 4;
constexpr int kFlacSampleSizeShift = 1;
constexpr uint8_t kFlacBlockAndRateCode = static_cast<uint8_t>(
    (kFlacBlockSizeCode4096 << kFlacHighNibbleShift) | kFlacRateCode44k1
);
constexpr uint8_t kFlacMono16Code = static_cast<uint8_t>(
    (kFlacChannelsMono << kFlacHighNibbleShift) |
    (kFlacSampleSizeCode16 << kFlacSampleSizeShift)
);
constexpr uint8_t kFlacConstantSubframe = 0x00;
constexpr uint8_t kFlacCrc8Poly = 0x07;
constexpr uint16_t kFlacCrc16Poly = 0x8005;
constexpr uint8_t kByteMask = 0xFF;
constexpr uint8_t kCrc8TopBit = 0x80;
constexpr uint16_t kCrc16TopBit = 0x8000;

inline void
PutBigEndian(uint64_t value, size_t bytes, std::vector<uint8_t>* out) {
  for (size_t i = bytes; i > 0; --i) {
    out->push_back(
        static_cast<uint8_t>((value >> ((i - 1) * kBitsPerByte)) & kByteMask)
    );
  }
}

inline uint8_t FlacCrc8(const uint8_t* data, size_t size) {
  uint8_t crc = 0;
  for (size_t i = 0; i < size; ++i) {
    crc ^= data[i];
    for (int b = 0; b < kBitsPerByte; ++b) {
      crc = (crc & kCrc8TopBit) != 0
                ? static_cast<uint8_t>((crc << 1) ^ kFlacCrc8Poly)
                : static_cast<uint8_t>(crc << 1);
    }
  }
  return crc;
}

inline uint16_t FlacCrc16(const uint8_t* data, size_t size) {
  uint16_t crc = 0;
  for (size_t i = 0; i < size; ++i) {
    crc ^= static_cast<uint16_t>(data[i] << kBitsPerByte);
    for (int b = 0; b < kBitsPerByte; ++b) {
      crc = (crc & kCrc16TopBit) != 0
                ? static_cast<uint16_t>((crc << 1) ^ kFlacCrc16Poly)
                : static_cast<uint16_t>(crc << 1);
    }
  }
  return crc;
}

inline void
AppendFlacStreamInfo(uint64_t total_frames, std::vector<uint8_t>* out) {
  out->insert(out->end(), kFlacMagic.begin(), kFlacMagic.end());
  out->push_back(kFlacLastStreamInfoBlock);
  PutBigEndian(kFlacStreamInfoBytes, kFlacFrameSizeBytes, out);
  PutBigEndian(kFlacBlockFrames, 2, out);
  PutBigEndian(kFlacBlockFrames, 2, out);
  PutBigEndian(0, kFlacFrameSizeBytes, out);
  PutBigEndian(0, kFlacFrameSizeBytes, out);
  const uint64_t packed =
      (static_cast<uint64_t>(kFlacRate) << kFlacRateShift) |
      (static_cast<uint64_t>(kFlacBitsPerSample - 1) << kFlacBitsShift) |
      total_frames;
  PutBigEndian(packed, sizeof(packed), out);
  out->resize(out->size() + kFlacMd5Bytes, 0);
}

// Single-byte frame numbers only, so the UTF-8 coding is the index itself.
inline void AppendFlacConstantFrame(int index, std::vector<uint8_t>* out) {
  const size_t start = out->size();
  out->insert(out->end(), kFlacFrameSync.begin(), kFlacFrameSync.end());
  out->push_back(kFlacBlockAndRateCode);
  out->push_back(kFlacMono16Code);
  out->push_back(static_cast<uint8_t>(index));
  out->push_back(FlacCrc8(out->data() + start, out->size() - start));
  out->push_back(kFlacConstantSubframe);
  PutBigEndian(kFlacConstantSample, 2, out);
  PutBigEndian(FlacCrc16(out->data() + start, out->size() - start), 2, out);
}

inline std::vector<uint8_t> BuildConstantFlac(int frames) {
  std::vector<uint8_t> out;
  if (frames > kFlacMaxSingleByteFrameIndex + 1) return out;
  AppendFlacStreamInfo(static_cast<uint64_t>(frames) * kFlacBlockFrames, &out);
  for (int f = 0; f < frames; ++f) AppendFlacConstantFrame(f, &out);
  return out;
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_FLAC_FIXTURE_H
