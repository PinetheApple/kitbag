#include "analysis/wav_declared_length.h"

#include <algorithm>
#include <array>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <limits>
#include <memory>

namespace kitbag {

namespace {

constexpr size_t kTagBytes = 4;
constexpr uint64_t kChunkHeaderBytes = 8;
constexpr int kMaxChunksBeforeData = 64;
// Streaming writers leave a placeholder near 2 or 4 GiB until they finish.
constexpr uint32_t kUnsizedDataThreshold = 0x7FFFF000;
constexpr uint16_t kFormatPcm = 1;
constexpr uint16_t kFormatFloat = 3;
constexpr uint16_t kFormatExtensible = 0xFFFE;
constexpr size_t kFmtChannelsOffset = 2;
constexpr size_t kFmtBlockAlignOffset = 12;
constexpr size_t kFmtBitsOffset = 14;
constexpr size_t kFmtPrefixBytes = kFmtBitsOffset + sizeof(uint16_t);
constexpr size_t kFmtSubFormatOffset = 24;
constexpr size_t kGuidBytes = 16;
constexpr size_t kFmtExtensibleBytes = kFmtSubFormatOffset + kGuidBytes;
constexpr std::array<uint8_t, kGuidBytes - sizeof(uint16_t)> kSubFormatSuffix =
    {0x00,
     0x00,
     0x00,
     0x00,
     0x10,
     0x00,
     0x80,
     0x00,
     0x00,
     0xAA,
     0x00,
     0x38,
     0x9B,
     0x71};
constexpr uint32_t kBitsPerByte = 8;

using Tag = std::array<char, kTagBytes>;
using FmtBytes = std::array<uint8_t, kFmtExtensibleBytes>;
using FileHandle = std::unique_ptr<std::FILE, int (*)(std::FILE*)>;

struct ChunkHeader {
  Tag id{};
  uint32_t size = 0;
};

uint32_t LoadLittleEndian(const uint8_t* bytes, size_t count) {
  uint32_t value = 0;
  for (size_t i = count; i > 0; --i) {
    value = (value << kBitsPerByte) | bytes[i - 1];
  }
  return value;
}

uint16_t LoadU16(const uint8_t* bytes) {
  return static_cast<uint16_t>(LoadLittleEndian(bytes, sizeof(uint16_t)));
}

bool IsTag(const Tag& tag, const char* expected) {
  return std::memcmp(tag.data(), expected, kTagBytes) == 0;
}

bool ReadChunkHeader(std::FILE* file, ChunkHeader* out) {
  std::array<uint8_t, sizeof(uint32_t)> size{};
  if (std::fread(out->id.data(), 1, kTagBytes, file) != kTagBytes ||
      std::fread(size.data(), 1, size.size(), file) != size.size()) {
    return false;
  }
  out->size = LoadLittleEndian(size.data(), size.size());
  return true;
}

bool ReadRiffWave(std::FILE* file, uint64_t* riff_end) {
  ChunkHeader riff;
  Tag form{};
  if (!ReadChunkHeader(file, &riff) || !IsTag(riff.id, "RIFF") ||
      std::fread(form.data(), 1, kTagBytes, file) != kTagBytes) {
    return false;
  }
  *riff_end = kChunkHeaderBytes + riff.size;
  return IsTag(form, "WAVE");
}

bool Skip(std::FILE* file, uint64_t bytes) {
  if (bytes > static_cast<uint64_t>(std::numeric_limits<long>::max())) {
    return false;
  }
  return std::fseek(file, static_cast<long>(bytes), SEEK_CUR) == 0;
}

uint64_t PaddedSize(uint32_t size) {
  return static_cast<uint64_t>(size) + (size & 1U);
}

bool IsPcmOrFloat(uint16_t code) {
  return code == kFormatPcm || code == kFormatFloat;
}

bool DeclaresFrames(const FmtBytes& fmt, uint32_t size) {
  const uint16_t tag = LoadU16(fmt.data());
  if (IsPcmOrFloat(tag)) return true;
  if (tag != kFormatExtensible || size < kFmtExtensibleBytes) return false;
  const uint8_t* guid = fmt.data() + kFmtSubFormatOffset;
  return IsPcmOrFloat(LoadU16(guid)) && std::equal(
                                            kSubFormatSuffix.begin(),
                                            kSubFormatSuffix.end(),
                                            guid + sizeof(uint16_t)
                                        );
}

// dr_wav's own frame size: blockAlign only when samples are not whole bytes.
uint32_t FrameBytes(const FmtBytes& fmt) {
  const uint32_t bits = LoadU16(fmt.data() + kFmtBitsOffset);
  const uint32_t channels = LoadU16(fmt.data() + kFmtChannelsOffset);
  const uint32_t block_align = LoadU16(fmt.data() + kFmtBlockAlignOffset);
  return bits % kBitsPerByte == 0 ? bits * channels / kBitsPerByte
                                  : block_align;
}

bool ReadFmtChunk(std::FILE* file, uint32_t size, uint32_t* frame_bytes) {
  FmtBytes fmt{};
  const size_t wanted = std::min<size_t>(size, fmt.size());
  if (std::fread(fmt.data(), 1, wanted, file) != wanted ||
      !Skip(file, PaddedSize(size) - wanted)) {
    return false;
  }
  const bool usable = size >= kFmtPrefixBytes && DeclaresFrames(fmt, size);
  *frame_bytes = usable ? FrameBytes(fmt) : 0;
  return true;
}

uint64_t DataFrames(
    std::FILE* file,
    uint32_t data_bytes,
    uint32_t frame_bytes,
    uint64_t riff_end
) {
  const long data_start = std::ftell(file);
  if (frame_bytes == 0 || data_start < 0) return 0;
  if (data_bytes >= kUnsizedDataThreshold) return 0;
  if (riff_end < static_cast<uint64_t>(data_start) + data_bytes) return 0;
  return data_bytes / frame_bytes;
}

}  // namespace

uint64_t WavDeclaredFrames(const char* path) {
  const FileHandle file(std::fopen(path, "rb"), &std::fclose);
  uint64_t riff_end = 0;
  if (file == nullptr || !ReadRiffWave(file.get(), &riff_end)) return 0;
  uint32_t frame_bytes = 0;
  for (int i = 0; i < kMaxChunksBeforeData; ++i) {
    ChunkHeader chunk;
    if (!ReadChunkHeader(file.get(), &chunk)) return 0;
    if (IsTag(chunk.id, "data")) {
      return DataFrames(file.get(), chunk.size, frame_bytes, riff_end);
    }
    const bool walked = IsTag(chunk.id, "fmt ")
                            ? ReadFmtChunk(file.get(), chunk.size, &frame_bytes)
                            : Skip(file.get(), PaddedSize(chunk.size));
    if (!walked) return 0;
  }
  return 0;
}

}  // namespace kitbag
