#ifndef KITBAG_TOOLS_MEDIA_WAV_FIXTURE_H
#define KITBAG_TOOLS_MEDIA_WAV_FIXTURE_H

// Writes a 16-bit PCM WAV at run time rather than committing a binary. 16-bit
// is the point: it is the format the decoder must convert from, and the format
// whose conversion was missing.
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

namespace media_test {

constexpr uint32_t kFixtureRate = 44100;
constexpr uint32_t kFixtureChannels = 2;
constexpr uint16_t kBitsPerSample = 16;
// Full-scale in s16. miniaudio converts s16 to float as s / 32768, so every
// expected float below is an exact binary fraction and comparisons need no
// epsilon.
constexpr float kS16Scale = 32768.0F;

// Sample n of the fixture, in s16 units. Alternating sign and a prime stride
// keep neighbouring samples far apart, so a half-written or byte-swapped read
// cannot land on a plausible value. The modulus is prime so the sequence does
// not repeat within the fixture, and sits just under s16 full scale so nothing
// clips on the way through the decoder.
inline int16_t FixtureSample(uint64_t index) {
  const int16_t magnitude = static_cast<int16_t>((index * 37) % 30011);
  return (index % 2 == 0) ? magnitude : static_cast<int16_t>(-magnitude);
}

// The float a correct decoder must produce for sample n.
inline float ExpectedFloat(uint64_t index) {
  return static_cast<float>(FixtureSample(index)) / kS16Scale;
}

inline void PutU32(std::vector<uint8_t>* out, uint32_t value) {
  for (int i = 0; i < 4; ++i) {
    out->push_back(static_cast<uint8_t>((value >> (i * 8)) & 0xFF));
  }
}

inline void PutU16(std::vector<uint8_t>* out, uint16_t value) {
  out->push_back(static_cast<uint8_t>(value & 0xFF));
  out->push_back(static_cast<uint8_t>(value >> 8));
}

inline void PutTag(std::vector<uint8_t>* out, const char* tag) {
  for (int i = 0; i < 4; ++i) out->push_back(static_cast<uint8_t>(tag[i]));
}

inline std::vector<uint8_t> BuildWav(uint64_t frames) {
  const uint32_t data_bytes =
      static_cast<uint32_t>(frames * kFixtureChannels * sizeof(int16_t));
  const uint32_t byte_rate =
      kFixtureRate * kFixtureChannels * (kBitsPerSample / 8);
  std::vector<uint8_t> out;
  PutTag(&out, "RIFF");
  PutU32(&out, 36 + data_bytes);
  PutTag(&out, "WAVE");
  PutTag(&out, "fmt ");
  PutU32(&out, 16);
  PutU16(&out, 1);  // PCM
  PutU16(&out, static_cast<uint16_t>(kFixtureChannels));
  PutU32(&out, kFixtureRate);
  PutU32(&out, byte_rate);
  PutU16(&out, static_cast<uint16_t>(kFixtureChannels * sizeof(int16_t)));
  PutU16(&out, kBitsPerSample);
  PutTag(&out, "data");
  PutU32(&out, data_bytes);
  for (uint64_t i = 0; i < frames * kFixtureChannels; ++i) {
    PutU16(&out, static_cast<uint16_t>(FixtureSample(i)));
  }
  return out;
}

inline bool WriteWav(const std::string& path, uint64_t frames) {
  const std::vector<uint8_t> bytes = BuildWav(frames);
  std::FILE* file = std::fopen(path.c_str(), "wb");
  if (file == nullptr) return false;
  const size_t written = std::fwrite(bytes.data(), 1, bytes.size(), file);
  std::fclose(file);
  return written == bytes.size();
}

}  // namespace media_test

#endif  // KITBAG_TOOLS_MEDIA_WAV_FIXTURE_H
