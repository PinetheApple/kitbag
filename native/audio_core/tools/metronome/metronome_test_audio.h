#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_AUDIO_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_AUDIO_H

#include <string>

#include "metronome_test_support.h"

namespace metronome_test {

constexpr int64_t kPitchWindow = 2400;
constexpr double kPitchTolerance = 0.05;

constexpr int kHihatSound = 4;
constexpr int64_t kRiseWindowFrames = 32;
constexpr int64_t kFrameSlack = 2;
constexpr double kHihatAccentHz = 5000.0;
constexpr int64_t kBeatFrames = kSampleRate / 2;

inline int64_t FramesFor(double seconds) {
  return static_cast<int64_t>(seconds * kSampleRate);
}

inline void
CheckCase(bool passed, const std::string& label, const char* detail) {
  if (!passed) std::fprintf(stderr, "  %s: %s\n", label.c_str(), detail);
  Check(passed, label.c_str());
}

// `after_block(end)` runs once each block's mirrors are published.
template <typename OnBlock, typename AfterBlock>
std::vector<float> RenderLeft(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block,
    AfterBlock after_block
) {
  std::vector<float> left;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  for (int64_t rendered = 0; rendered < total_frames;
       rendered += kBlockFrames) {
    on_block(rendered);
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      left.push_back(buffer[static_cast<size_t>(frame) * kChannels]);
    }
    after_block(rendered + kBlockFrames);
  }
  return left;
}

template <typename OnBlock>
std::vector<float> RenderLeft(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block
) {
  return RenderLeft(metronome, total_frames, on_block, [](int64_t) {});
}

inline std::vector<float>
RenderLeft(kitbag::Metronome& metronome, int64_t frames) {
  return RenderLeft(metronome, frames, [](int64_t) {});
}

inline double PeakOver(const std::vector<float>& left, int64_t lo, int64_t hi) {
  double peak = 0.0;
  const int64_t end = std::min<int64_t>(hi, static_cast<int64_t>(left.size()));
  for (int64_t i = std::max<int64_t>(lo, 0); i < end; ++i) {
    peak = std::max(
        peak,
        std::fabs(static_cast<double>(left[static_cast<size_t>(i)]))
    );
  }
  return peak;
}

inline double PitchAt(const std::vector<float>& left, int64_t onset) {
  int crossings = 0;
  for (int64_t i = onset + 1; i < onset + kPitchWindow; ++i) {
    const auto at = static_cast<size_t>(i);
    if ((left[at - 1] < 0.0f) != (left[at] < 0.0f)) ++crossings;
  }
  return crossings / 2.0 * kSampleRate / static_cast<double>(kPitchWindow);
}

inline bool PitchIs(const std::vector<float>& left, int64_t onset, double hz) {
  return std::fabs(PitchAt(left, onset) - hz) <= hz * kPitchTolerance;
}

inline double PeakIn(const std::vector<float>& left, int64_t onset) {
  double peak = 0.0;
  for (int64_t i = onset; i < onset + kPitchWindow; ++i) {
    peak = std::max(
        peak,
        std::fabs(static_cast<double>(left[static_cast<size_t>(i)]))
    );
  }
  return peak;
}

inline bool SameSamples(
    const std::vector<float>& a,
    int64_t a_from,
    const std::vector<float>& b,
    int64_t b_from,
    int64_t count
) {
  if (a_from + count > static_cast<int64_t>(a.size()) ||
      b_from + count > static_cast<int64_t>(b.size())) {
    return false;
  }
  for (int64_t i = 0; i < count; ++i) {
    if (a[static_cast<size_t>(a_from + i)] !=
        b[static_cast<size_t>(b_from + i)]) {
      return false;
    }
  }
  return true;
}

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_AUDIO_H
