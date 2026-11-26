#ifndef KITBAG_TOOLS_ABI_TEST_SONG_RIG_H
#define KITBAG_TOOLS_ABI_TEST_SONG_RIG_H

#include "kitbag_api.h"

#include <time.h>

#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <vector>

#include "abi_test_render.h"
#include "rt/monotonic_clock.h"

namespace abi_test {

inline constexpr uint32_t kRigBlock = 256;
inline constexpr double kOnsetLevel = 0.05;
// An accented tick decays below kOnsetLevel within ~530 frames, so a re-fired
// tick any later than this still starts a fresh onset.
inline constexpr int64_t kOnsetHold = 1200;
inline constexpr int64_t kOnsetPeakWindow = 240;
inline constexpr int kOffsetAttempts = 8;
inline constexpr int64_t kSteadyOffsetNs = 1000;
inline constexpr int64_t kMeasureOffset = INT64_MIN;
#ifdef CLOCK_BOOTTIME
inline constexpr clockid_t kRawBoottime = CLOCK_BOOTTIME;
#else
inline constexpr clockid_t kRawBoottime = CLOCK_MONOTONIC;
#endif

inline int64_t RawNs(clockid_t clock) {
  timespec now{};
  clock_gettime(clock, &now);
  return static_cast<int64_t>(now.tv_sec) * kitbag::kNsPerSecond + now.tv_nsec;
}

inline int64_t RawSuspendedNs() {
  const int64_t before = RawNs(CLOCK_MONOTONIC);
  const int64_t boottime = RawNs(kRawBoottime);
  const int64_t after = RawNs(CLOCK_MONOTONIC);
  return boottime - before - (after - before) / 2;
}

struct Onset {
  int64_t frame;
  double peak;
};

// Renders offline with every block's clock pair stamped as if frame 0 played
// at monotonic base_ns, so the pair a mapping reads is known to the frame.
struct SongRig {
  kb_engine* engine = nullptr;
  int64_t base_ns = 0;
  int64_t forced_offset_ns = kMeasureOffset;
  int64_t rendered = 0;
  std::vector<Onset> onsets;
  float previous = 0.0F;

  int64_t MonotonicAt(double frame) const {
    return base_ns + std::llround(
                         frame * static_cast<double>(kitbag::kNsPerSecond) /
                         kb_engine_sample_rate(engine)
                     );
  }

  void Render(uint32_t frames, int64_t late_ns = 0) {
    std::vector<float> out(static_cast<size_t>(frames) * kChannels);
    const int64_t stamp = MonotonicAt(static_cast<double>(rendered)) + late_ns;
    kb_engine_render_at(engine, out.data(), frames, stamp);
    Detect(out, frames);
    rendered += frames;
  }

  void Detect(const std::vector<float>& out, uint32_t frames) {
    for (uint32_t i = 0; i < frames; ++i) {
      const float level = std::fabs(out[static_cast<size_t>(i) * kChannels]);
      const int64_t frame = rendered + i;
      const bool fresh =
          onsets.empty() || frame - onsets.back().frame >= kOnsetHold;
      if (level > kOnsetLevel && previous <= kOnsetLevel && fresh) {
        onsets.push_back({frame, 0.0});
      }
      if (!onsets.empty() && frame - onsets.back().frame < kOnsetPeakWindow) {
        onsets.back().peak = std::fmax(onsets.back().peak, level);
      }
      previous = level;
    }
  }

  // Retries while the boottime offset moved under the call, so a preemption
  // between the test's reads and the engine's cannot fake a wrong frame.
  bool FrameAt(double frame, int64_t* out) const {
    if (forced_offset_ns != kMeasureOffset) {
      const int64_t boottime = MonotonicAt(frame) + forced_offset_ns;
      return kb_engine_frame_at_boottime(engine, boottime, out) == KB_OK;
    }
    for (int attempt = 0; attempt < kOffsetAttempts; ++attempt) {
      const int64_t offset = RawSuspendedNs();
      const int64_t boottime = MonotonicAt(frame) + offset;
      if (kb_engine_frame_at_boottime(engine, boottime, out) != KB_OK) {
        return false;
      }
      if (std::llabs(RawSuspendedNs() - offset) < kSteadyOffsetNs) return true;
    }
    return false;
  }
};

}  // namespace abi_test

#endif  // KITBAG_TOOLS_ABI_TEST_SONG_RIG_H
