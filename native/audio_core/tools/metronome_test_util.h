#ifndef KITBAG_METRONOME_TEST_UTIL_H
#define KITBAG_METRONOME_TEST_UTIL_H

// Shared rig for the metronome_verify suite: offline rendering, onset
// detection and the assertion helpers. One executable, several test files.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <memory>
#include <vector>

#include "../src/metronome.h"

namespace metronome_test {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kChannels = 2;
constexpr uint32_t kBlockFrames = 256;
constexpr double kOnsetThreshold = 0.05;
// A click is one onset; the window must outlast the click's decay tail
// (~4600 frames at the slowest preset) while staying under the smallest
// inter-click gap in these tests (12000 frames).
constexpr int kOnsetHoldFrames = 6000;
constexpr double kMaxJitterFrames = 1.5;
// Grid beats are placed from doubles in seconds, so allow a couple of samples
// of rounding on top of the click's attack.
constexpr double kGridToleranceFrames = 4.0;

inline int g_failures = 0;

inline void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

// Detects onsets in one rendered block, appending to `onsets`. `last_onset`
// and `previous_abs` carry the detector's state across blocks.
inline void DetectOnsets(
    const std::vector<float>& buffer,
    int64_t block_start,
    std::vector<int64_t>* onsets,
    int64_t* last_onset,
    float* previous_abs
) {
  for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
    const float amplitude = std::fabs(buffer[frame * kChannels]);
    const int64_t index = block_start + frame;
    if (amplitude > kOnsetThreshold && *previous_abs <= kOnsetThreshold &&
        index - *last_onset >= kOnsetHoldFrames) {
      onsets->push_back(index);
      *last_onset = index;
    }
    *previous_abs = amplitude;
  }
}

// Renders a continuous frame range from frame 0, letting the caller act at
// block boundaries. Grid mode is driven by the absolute engine frame, so grid
// tests must use this rather than restarting the transport per call.
template <typename OnFrame>
std::vector<int64_t> RenderContinuous(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnFrame on_frame
) {
  std::vector<float> buffer(kBlockFrames * kChannels);
  std::vector<int64_t> onsets;
  int64_t rendered = 0;
  int64_t last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;

  while (rendered < total_frames) {
    on_frame(rendered);
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    DetectOnsets(buffer, rendered, &onsets, &last_onset, &previous_abs);
    rendered += kBlockFrames;
  }
  return onsets;
}

inline std::vector<int64_t>
RenderAndDetectOnsets(kitbag::Metronome& metronome, int64_t total_frames) {
  return RenderContinuous(metronome, total_frames, [](int64_t) {});
}

inline void ExpectSpacing(
    const std::vector<int64_t>& onsets,
    size_t from,
    size_t to,
    double expected_frames,
    const char* label
) {
  for (size_t i = from + 1; i < to && i < onsets.size(); ++i) {
    const double spacing = static_cast<double>(onsets[i] - onsets[i - 1]);
    if (std::fabs(spacing - expected_frames) > kMaxJitterFrames) {
      std::fprintf(
          stderr,
          "FAIL: %s interval %zu = %.1f, expected %.1f\n",
          label,
          i,
          spacing,
          expected_frames
      );
      ++g_failures;
      return;
    }
  }
}

// Every onset must land on its counterpart in `expected_sec`, in order.
inline void ExpectOnsetsAtSeconds(
    const std::vector<int64_t>& onsets,
    const std::vector<double>& expected_sec,
    const char* label
) {
  for (size_t i = 0; i < onsets.size() && i < expected_sec.size(); ++i) {
    const double want = expected_sec[i] * kSampleRate;
    if (std::fabs(static_cast<double>(onsets[i]) - want) >
        kGridToleranceFrames) {
      std::fprintf(
          stderr,
          "FAIL: %s onset %zu at %lld, expected %.0f\n",
          label,
          i,
          static_cast<long long>(onsets[i]),
          want
      );
      ++g_failures;
      return;
    }
  }
}

// Every onset must coincide with some beat in the grid, in any order.
inline void ExpectOnGrid(
    const std::vector<int64_t>& onsets,
    const std::vector<double>& times,
    const char* label
) {
  for (const int64_t onset : onsets) {
    bool matched = false;
    for (const double t : times) {
      if (std::fabs(static_cast<double>(onset) - t * kSampleRate) <=
          kGridToleranceFrames) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      std::fprintf(
          stderr,
          "FAIL: %s — onset %lld is not on any grid beat\n",
          label,
          static_cast<long long>(onset)
      );
      ++g_failures;
      return;
    }
  }
}

// Builds a grid whose beats accelerate: spacing shrinks by `shrink` each beat.
// A constant BPM cannot follow this, which is the point of grid mode.
inline std::unique_ptr<kitbag::BeatGrid> MakeDriftingGrid(
    int count,
    double first_interval,
    double shrink,
    uint64_t anchor_frame
) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  double t = 0.0;
  double interval = first_interval;
  for (int i = 0; i < count; ++i) {
    grid->beat_times_sec.push_back(t);
    t += interval;
    interval -= shrink;
  }
  grid->anchor_frame = anchor_frame;
  return grid;
}

// Evenly spaced grid displaced by `offset_sec`, so every beat of the outgoing
// grid moves — what a re-anchor test needs.
inline std::unique_ptr<kitbag::BeatGrid>
MakeShiftedGrid(int count, double offset_sec, double interval_sec) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (int i = 0; i < count; ++i) {
    grid->beat_times_sec.push_back(offset_sec + interval_sec * i);
  }
  grid->anchor_frame = 0;
  return grid;
}

void RunBasicTests();
void RunStartAtTests();
void RunLatencyTests();
void RunGridTests();
void RunPublisherTests();

}  // namespace metronome_test

#endif  // KITBAG_METRONOME_TEST_UTIL_H
