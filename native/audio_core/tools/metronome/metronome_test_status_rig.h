#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_STATUS_RIG_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_STATUS_RIG_H

#include <algorithm>
#include <cstdint>
#include <vector>

#include "metronome/metronome.h"
#include "metronome_test_support.h"

namespace metronome_test {

constexpr int64_t kBar100Bpm44 = 115200;

inline int64_t At(int64_t bar_frames, double bars) {
  return static_cast<int64_t>(static_cast<double>(bar_frames) * bars);
}

inline int64_t Seconds(double seconds) {
  return static_cast<int64_t>(seconds * kSampleRate);
}

struct StatusRig {
  kitbag::Metronome metronome;
  int64_t rendered = 0;
  std::vector<float> buffer = std::vector<float>(kBlockFrames * kChannels);

  void RenderBlock() {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    rendered += kBlockFrames;
  }
  void RenderTo(int64_t frame) {
    while (rendered < frame) RenderBlock();
  }
};

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_STATUS_RIG_H
