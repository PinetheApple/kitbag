#ifndef KITBAG_TOOLS_ANALYSIS_MP3_FIXTURE_H
#define KITBAG_TOOLS_ANALYSIS_MP3_FIXTURE_H

// A VBR MPEG-1 Layer III stream with no Xing/VBRI/LAME frame, built at runtime.
// Zeroed side info decodes every frame to 1152 silent samples.
#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace analyze_test {

constexpr uint32_t kMp3Rate = 44100;
constexpr uint64_t kMp3FrameSamples = 1152;
constexpr uint32_t kMp3FrameBytesPerKbps = 144000;
constexpr uint8_t kMp3SyncByte = 0xFF;
constexpr uint8_t kMp3Mpeg1Layer3NoCrc = 0xFB;
constexpr uint8_t kMp3MonoMode = 0xC0;
constexpr int kMp3BitrateShift = 4;

struct Mp3Bitrate {
  uint8_t index;
  uint32_t kbps;
};

// The first frame is the slowest, so a first-frame-bitrate estimate overshoots.
constexpr std::array<Mp3Bitrate, 5> kMp3Bitrates = {{
    {1, 32},
    {14, 320},
    {9, 128},
    {11, 192},
    {5, 64},
}};

inline size_t Mp3FrameBytes(uint32_t kbps) {
  return kMp3FrameBytesPerKbps * kbps / kMp3Rate;
}

inline std::vector<uint8_t> BuildHeaderlessVbrMp3(int frames) {
  std::vector<uint8_t> out;
  for (int f = 0; f < frames; ++f) {
    const Mp3Bitrate rate = kMp3Bitrates[f % kMp3Bitrates.size()];
    const size_t start = out.size();
    out.push_back(kMp3SyncByte);
    out.push_back(kMp3Mpeg1Layer3NoCrc);
    out.push_back(static_cast<uint8_t>(rate.index << kMp3BitrateShift));
    out.push_back(kMp3MonoMode);
    out.resize(start + Mp3FrameBytes(rate.kbps), 0);
  }
  return out;
}

inline double FirstFrameBitrateEstimateSec(size_t file_bytes) {
  constexpr double kBitsPerByte = 8.0;
  constexpr double kBitsPerKbit = 1000.0;
  return static_cast<double>(file_bytes) * kBitsPerByte /
         (kMp3Bitrates[0].kbps * kBitsPerKbit);
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_MP3_FIXTURE_H
