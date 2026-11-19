#ifndef KITBAG_TOOLS_METRONOME_CUSTOM_SOUND_FIXTURE_H
#define KITBAG_TOOLS_METRONOME_CUSTOM_SOUND_FIXTURE_H

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "metronome/metronome.h"
#include "metronome_test_audio.h"
#include "zero_clock.h"

namespace metronome_test {

constexpr int kCustomSlot = 0;
constexpr int kEmptySlot = 1;
constexpr int kCustomSound = kitbag::Metronome::kFirstCustomSound + kCustomSlot;
constexpr int kEmptySound = kitbag::Metronome::kFirstCustomSound + kEmptySlot;
constexpr float kMaxStep = 0.01F;
constexpr auto kCutFadeFrames =
    static_cast<int64_t>(kitbag::SampleVoices::kCutFadeFrames);

size_t LiveHeapBytes();
size_t HeapPeakGrowth();
void ResetHeapPeak();

// Off-zero from the first frame and never periodic on a round frame count, so
// a hit one frame early or late, or at another gain, cannot match it.
inline std::vector<float> HitShape(size_t frames) {
  std::vector<float> shape(frames);
  for (size_t i = 0; i < frames; ++i) {
    shape[i] = static_cast<float>(
        0.37 * std::sin(0.0731 * static_cast<double>(i) + 0.4) + 0.21
    );
  }
  return shape;
}

inline std::vector<float> Level(size_t frames, float level) {
  return std::vector<float>(frames, level);
}

inline void Load(
    kitbag::Metronome& metronome,
    const std::vector<float>& frames,
    int64_t now = 0,
    bool running = false
) {
  metronome.custom_sounds()
      .Publish(kCustomSlot, frames, kitbag_test::ClockAt(now), running);
}

inline float MaxStep(const std::vector<float>& left, int64_t from, int64_t to) {
  float step = 0.0F;
  for (int64_t i = std::max<int64_t>(from, 1); i < to; ++i) {
    const auto at = static_cast<size_t>(i);
    step = std::max(step, std::fabs(left[at] - left[at - 1]));
  }
  return step;
}

inline bool Silent(const std::vector<float>& left, int64_t from, int64_t to) {
  for (int64_t i = from; i < to; ++i) {
    if (left[static_cast<size_t>(i)] != 0.0F) return false;
  }
  return true;
}

inline int64_t FirstSoundFrom(const std::vector<float>& left, int64_t from) {
  for (auto i = static_cast<size_t>(std::max<int64_t>(from, 0));
       i < left.size();
       ++i) {
    if (left[i] != 0.0F) return static_cast<int64_t>(i);
  }
  return -1;
}

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_CUSTOM_SOUND_FIXTURE_H
