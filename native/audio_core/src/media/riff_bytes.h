#ifndef KITBAG_MEDIA_RIFF_BYTES_H
#define KITBAG_MEDIA_RIFF_BYTES_H

#include <cstddef>
#include <cstdint>
#include <vector>

namespace kitbag::riff {

inline constexpr unsigned kByteBits = 8;
inline constexpr unsigned kByteMask = 0xFF;
inline constexpr size_t kTagChars = 4;
inline constexpr uint32_t kFmtChunkBytes = 16;
// RIFF counts everything after its own tag and size field.
inline constexpr uint32_t kRiffPreambleBytes = 8;

inline void PutU16(std::vector<uint8_t>* out, uint16_t value) {
  out->push_back(static_cast<uint8_t>(value & kByteMask));
  out->push_back(static_cast<uint8_t>(value >> kByteBits));
}

inline void PutU32(std::vector<uint8_t>* out, uint32_t value) {
  for (unsigned shift = 0; shift < sizeof(uint32_t) * kByteBits;
       shift += kByteBits) {
    out->push_back(static_cast<uint8_t>((value >> shift) & kByteMask));
  }
}

inline void
PutTag(std::vector<uint8_t>* out, const char (&tag)[kTagChars + 1]) {
  out->insert(out->end(), tag, tag + kTagChars);
}

}  // namespace kitbag::riff

#endif  // KITBAG_MEDIA_RIFF_BYTES_H
