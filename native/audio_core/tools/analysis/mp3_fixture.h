#ifndef KITBAG_TOOLS_ANALYSIS_MP3_FIXTURE_H
#define KITBAG_TOOLS_ANALYSIS_MP3_FIXTURE_H

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace analyze_test {

constexpr uint32_t kMp3Rate = 44100;
constexpr uint64_t kMp3FrameSamples = 1152;
constexpr uint64_t kBitsPerByte = 8;
constexpr uint64_t kBitsPerKbit = 1000;
constexpr uint8_t kMp3SyncByte = 0xFF;
constexpr uint8_t kMp3Mpeg1Layer3NoCrc = 0xFB;
constexpr uint8_t kMp3MonoMode = 0xC0;
constexpr int kMp3BitrateShift = 4;
constexpr uint8_t kMp3RateIndex44k1 = 0;
constexpr int kMp3SampleRateShift = 2;
constexpr size_t kMp3HeaderBytes = 4;
constexpr size_t kMp3MonoSideInfoBytes = 17;
constexpr std::array<uint8_t, 4> kXingTag = {'X', 'i', 'n', 'g'};
constexpr size_t kXingFlagsOffset = 7;
constexpr uint8_t kXingFramesFlag = 0x01;
constexpr size_t kXingFramesOffset = 8;
constexpr int kBitsPerByteShift = 8;

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

constexpr Mp3Bitrate kXingFrameBitrate = {9, 128};

inline size_t Mp3FrameBytes(uint32_t kbps) {
  return kMp3FrameSamples * kbps * kBitsPerKbit / kBitsPerByte / kMp3Rate;
}

inline uint8_t Mp3RateByte(const Mp3Bitrate& rate) {
  return static_cast<uint8_t>(
      (rate.index << kMp3BitrateShift) |
      (kMp3RateIndex44k1 << kMp3SampleRateShift)
  );
}

inline void AppendMp3Frame(const Mp3Bitrate& rate, std::vector<uint8_t>* out) {
  const size_t start = out->size();
  out->push_back(kMp3SyncByte);
  out->push_back(kMp3Mpeg1Layer3NoCrc);
  out->push_back(Mp3RateByte(rate));
  out->push_back(kMp3MonoMode);
  out->resize(start + Mp3FrameBytes(rate.kbps), 0);
}

// Zeroed side info decodes every frame to kMp3FrameSamples of silence, and no
// Xing/VBRI/LAME frame tells the decoder the length.
inline std::vector<uint8_t> BuildVbrMp3WithoutInfoFrame(int frames) {
  std::vector<uint8_t> out;
  for (int f = 0; f < frames; ++f) {
    AppendMp3Frame(kMp3Bitrates[f % kMp3Bitrates.size()], &out);
  }
  return out;
}

// dr_mp3 takes the file's length from a Xing frame count, so a count above the
// frames present makes the reported length disagree with the decoded one.
inline std::vector<uint8_t>
BuildMp3WithXingFrameCount(int frames, uint32_t claimed_frames) {
  std::vector<uint8_t> out;
  AppendMp3Frame(kXingFrameBitrate, &out);
  const size_t tag = kMp3HeaderBytes + kMp3MonoSideInfoBytes;
  std::copy(kXingTag.begin(), kXingTag.end(), out.begin() + tag);
  out[tag + kXingFlagsOffset] = kXingFramesFlag;
  for (size_t i = 0; i < sizeof(claimed_frames); ++i) {
    const size_t shift = (sizeof(claimed_frames) - 1 - i) * kBitsPerByteShift;
    out[tag + kXingFramesOffset + i] =
        static_cast<uint8_t>(claimed_frames >> shift);
  }
  const std::vector<uint8_t> body = BuildVbrMp3WithoutInfoFrame(frames);
  out.insert(out.end(), body.begin(), body.end());
  return out;
}

inline double FirstFrameBitrateEstimateSec(size_t file_bytes) {
  return static_cast<double>(file_bytes * kBitsPerByte) /
         static_cast<double>(kMp3Bitrates[0].kbps * kBitsPerKbit);
}

}  // namespace analyze_test

#endif  // KITBAG_TOOLS_ANALYSIS_MP3_FIXTURE_H
