#ifndef KITBAG_TOOLS_ANALYSIS_WAV_SHAPE_FIXTURE_H
#define KITBAG_TOOLS_ANALYSIS_WAV_SHAPE_FIXTURE_H

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <vector>

#include "media/wav_fixture.h"

namespace analyze_test {

constexpr uint16_t kWavFormatPcm = 1;
constexpr uint16_t kWavFormatExtensible = 0xFFFE;
constexpr uint32_t kWavFmtBytes = 16;
constexpr uint16_t kWavExtensibleExtraBytes = 22;
constexpr uint32_t kWavStereoChannelMask = 3;
constexpr uint32_t kRiffFormBytes = 4;
constexpr uint32_t kChunkHeaderBytes = 8;
constexpr uint32_t kWavFrameBytes =
    media_test::kFixtureChannels * sizeof(int16_t);

using Guid = std::array<uint8_t, 16>;

constexpr Guid kPcmSubFormat = {
    0x01,
    0x00,
    0x00,
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
    0x71
};
// dr_wav reads only a GUID's first two bytes, so it decodes this as plain PCM.
constexpr Guid kAmbisonicPcmSubFormat = {
    0x01,
    0x00,
    0x00,
    0x00,
    0x21,
    0x07,
    0xD3,
    0x11,
    0x86,
    0x44,
    0xC8,
    0xC1,
    0xCA,
    0x00,
    0x00,
    0x00
};

struct WavShape {
  uint16_t block_align = kWavFrameBytes;
  const Guid* sub_format = nullptr;
  std::vector<uint8_t> chunks_before_data;
  std::optional<uint32_t> riff_size;
  std::optional<uint32_t> data_size;
};

inline void AppendFmt(const WavShape& shape, std::vector<uint8_t>* out) {
  using media_test::PutU16;
  using media_test::PutU32;
  const bool extensible = shape.sub_format != nullptr;
  media_test::PutTag(out, "fmt ");
  PutU32(
      out,
      kWavFmtBytes +
          (extensible ? sizeof(uint16_t) + kWavExtensibleExtraBytes : 0)
  );
  PutU16(out, extensible ? kWavFormatExtensible : kWavFormatPcm);
  PutU16(out, static_cast<uint16_t>(media_test::kFixtureChannels));
  PutU32(out, media_test::kFixtureRate);
  PutU32(out, media_test::kFixtureRate * kWavFrameBytes);
  PutU16(out, shape.block_align);
  PutU16(out, media_test::kBitsPerSample);
  if (!extensible) return;
  PutU16(out, kWavExtensibleExtraBytes);
  PutU16(out, media_test::kBitsPerSample);
  PutU32(out, kWavStereoChannelMask);
  out->insert(out->end(), shape.sub_format->begin(), shape.sub_format->end());
}

inline std::vector<uint8_t>
BuildShapedWav(uint64_t frames, const WavShape& shape) {
  std::vector<uint8_t> body;
  AppendFmt(shape, &body);
  body.insert(
      body.end(),
      shape.chunks_before_data.begin(),
      shape.chunks_before_data.end()
  );
  const auto data_bytes = static_cast<uint32_t>(frames * kWavFrameBytes);
  std::vector<uint8_t> out;
  media_test::PutTag(&out, "RIFF");
  media_test::PutU32(
      &out,
      shape.riff_size.value_or(
          kRiffFormBytes + body.size() + kChunkHeaderBytes + data_bytes
      )
  );
  media_test::PutTag(&out, "WAVE");
  out.insert(out.end(), body.begin(), body.end());
  media_test::PutTag(&out, "data");
  media_test::PutU32(&out, shape.data_size.value_or(data_bytes));
  for (uint64_t i = 0; i < frames * media_test::kFixtureChannels; ++i) {
    media_test::PutU16(
        &out,
        static_cast<uint16_t>(media_test::FixtureSample(i))
    );
  }
  return out;
}

inline std::vector<uint8_t> OddSizedChunk() {
  constexpr std::array<uint8_t, 3> kPayload = {'o', 'd', 'd'};
  std::vector<uint8_t> out;
  media_test::PutTag(&out, "junk");
  media_test::PutU32(&out, kPayload.size());
  out.insert(out.end(), kPayload.begin(), kPayload.end());
  out.push_back(0);
  return out;
}

inline std::vector<uint8_t> ListInfoChunk() {
  constexpr std::array<uint8_t, 4> kTitle = {'s', 'o', 'n', 'g'};
  std::vector<uint8_t> out;
  media_test::PutTag(&out, "LIST");
  media_test::PutU32(&out, kRiffFormBytes + kChunkHeaderBytes + kTitle.size());
  media_test::PutTag(&out, "INFO");
  media_test::PutTag(&out, "INAM");
  media_test::PutU32(&out, kTitle.size());
  out.insert(out.end(), kTitle.begin(), kTitle.end());
  return out;
}

inline std::vector<uint8_t>
DropFrames(std::vector<uint8_t> bytes, uint64_t frames) {
  bytes.resize(bytes.size() - frames * kWavFrameBytes);
  return bytes;
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_WAV_SHAPE_FIXTURE_H
