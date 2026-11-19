#include "analysis/wav_declared_length.h"

#include <array>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <limits>
#include <memory>

namespace kitbag {

namespace {

constexpr size_t kTagBytes = 4;
constexpr int kMaxChunksBeforeData = 64;
constexpr uint32_t kUnsizedDataChunk = 0xFFFFFFFF;
constexpr uint16_t kFormatPcm = 1;
constexpr uint16_t kFormatFloat = 3;
constexpr uint16_t kFormatExtensible = 0xFFFE;
constexpr size_t kFmtBlockAlignOffset = 12;
constexpr uint32_t kFmtPrefixBytes = 14;
constexpr int kByteBits = 8;

using Tag = std::array<char, kTagBytes>;
using FileHandle = std::unique_ptr<std::FILE, int (*)(std::FILE*)>;

struct ChunkHeader {
  Tag id{};
  uint32_t size = 0;
};

uint32_t LoadLittleEndian(const uint8_t* bytes, size_t count) {
  uint32_t value = 0;
  for (size_t i = count; i > 0; --i) {
    value = (value << kByteBits) | bytes[i - 1];
  }
  return value;
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

bool IsRiffWave(std::FILE* file) {
  ChunkHeader riff;
  Tag form{};
  return ReadChunkHeader(file, &riff) && IsTag(riff.id, "RIFF") &&
         std::fread(form.data(), 1, kTagBytes, file) == kTagBytes &&
         IsTag(form, "WAVE");
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

// 0 for compressed formats: their block align is not one frame.
uint16_t ReadFrameBytes(std::FILE* file, uint32_t chunk_size) {
  std::array<uint8_t, kFmtPrefixBytes> fmt{};
  if (chunk_size < kFmtPrefixBytes ||
      std::fread(fmt.data(), 1, fmt.size(), file) != fmt.size() ||
      !Skip(file, PaddedSize(chunk_size) - kFmtPrefixBytes)) {
    return 0;
  }
  const auto format = static_cast<uint16_t>(LoadLittleEndian(fmt.data(), 2));
  if (format != kFormatPcm && format != kFormatFloat &&
      format != kFormatExtensible) {
    return 0;
  }
  return static_cast<uint16_t>(
      LoadLittleEndian(fmt.data() + kFmtBlockAlignOffset, 2)
  );
}

uint64_t DataFrames(uint32_t data_bytes, uint16_t frame_bytes) {
  if (frame_bytes == 0 || data_bytes == kUnsizedDataChunk) return 0;
  return data_bytes / frame_bytes;
}

}  // namespace

uint64_t WavDeclaredFrames(const char* path) {
  const FileHandle file(std::fopen(path, "rb"), &std::fclose);
  if (file == nullptr || !IsRiffWave(file.get())) return 0;
  uint16_t frame_bytes = 0;
  for (int i = 0; i < kMaxChunksBeforeData; ++i) {
    ChunkHeader chunk;
    if (!ReadChunkHeader(file.get(), &chunk)) return 0;
    if (IsTag(chunk.id, "data")) return DataFrames(chunk.size, frame_bytes);
    if (IsTag(chunk.id, "fmt ")) {
      frame_bytes = ReadFrameBytes(file.get(), chunk.size);
    } else if (!Skip(file.get(), PaddedSize(chunk.size))) {
      return 0;
    }
  }
  return 0;
}

}  // namespace kitbag
