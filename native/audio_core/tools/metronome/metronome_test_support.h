#ifndef KITBAG_TOOLS_METRONOME_METRONOME_TEST_SUPPORT_H
#define KITBAG_TOOLS_METRONOME_METRONOME_TEST_SUPPORT_H

// Shared rig for the metronome_verify suite: offline rendering, onset
// detection and the metronome-specific assertions. One executable, several files.
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <memory>
#include <vector>

#include "check.h"
#include "metronome/metronome.h"

namespace metronome_test {

using kitbag_test::Check;
using kitbag_test::g_failures;

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
template <typename OnBlock>
std::vector<int64_t> RenderContinuous(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block
) {
  std::vector<float> buffer(kBlockFrames * kChannels);
  std::vector<int64_t> onsets;
  int64_t rendered = 0;
  int64_t last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;

  while (rendered < total_frames) {
    on_block(rendered);
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

// The absolute frame of the first sample the scheduler writes non-zero, or -1.
// Bypasses the onset detector's attack tolerance to reach the exact sample,
// which is what pins start_at as frame-exact rather than frame-exact-give-or-take.
inline int64_t
FirstNonzeroFrame(kitbag::Metronome& metronome, int64_t total_frames) {
  std::vector<float> buffer(kBlockFrames * kChannels);
  for (int64_t rendered = 0; rendered < total_frames;
       rendered += kBlockFrames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      if (buffer[frame * kChannels] != 0.0f) return rendered + frame;
    }
  }
  return -1;
}

// An on-block callback that runs `action(block_start)` once, at the first block
// on or after `frame`. The swap/recall-once idiom every re-anchor test shares.
template <typename Action>
auto OnceAtFrame(int64_t frame, Action action) {
  return [frame, action, fired = false](int64_t block_start) mutable {
    if (!fired && block_start >= frame) {
      action(block_start);
      fired = true;
    }
  };
}

inline void ExpectSpacing(
    const std::vector<int64_t>& onsets,
    size_t from,
    size_t to,
    double expected_frames,
    const char* label
) {
  Check(onsets.size() >= to, label);
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

// Every onset must land on its counterpart in `expected_sec`, one for one.
inline void ExpectOnsetsAtSeconds(
    const std::vector<int64_t>& onsets,
    const std::vector<double>& expected_sec,
    const char* label
) {
  Check(onsets.size() == expected_sec.size(), label);
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

// Every onset must coincide with some beat in the grid, in any order. An empty
// render satisfies that vacuously, so `min_onsets` is not optional.
inline void ExpectOnGrid(
    const std::vector<int64_t>& onsets,
    const std::vector<double>& times,
    size_t min_onsets,
    const char* label
) {
  Check(onsets.size() >= min_onsets, label);
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

// Peak |sample| in the left channel over frames [first, last) of one block.
inline double
BlockPeak(const std::vector<float>& buffer, uint32_t first, uint32_t last) {
  double peak = 0.0;
  for (uint32_t frame = first; frame < last; ++frame) {
    peak = std::max(
        peak,
        std::fabs(static_cast<double>(buffer[frame * kChannels]))
    );
  }
  return peak;
}

// Peak |sample| per rendered block, acting at block boundaries. Resolves events
// the onset detector cannot: a click re-fired within kOnsetHoldFrames still
// lifts its block's peak, and the callback lets a re-anchor land mid-run.
template <typename OnBlock>
std::vector<double> RenderContinuousPeaks(
    kitbag::Metronome& metronome,
    int64_t total_frames,
    OnBlock on_block
) {
  std::vector<float> buffer(kBlockFrames * kChannels);
  std::vector<double> peaks;
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
    peaks.push_back(BlockPeak(buffer, 0, kBlockFrames));
  }
  return peaks;
}

// Peak |sample| over an absolute frame window, rendered fresh from frame 0. At
// high bpm subdivisions sit closer than kOnsetHoldFrames, so the onset detector
// merges them; only a windowed peak isolates a single click.
inline double
WindowedPeak(kitbag::Metronome& metronome, int64_t lo, int64_t hi) {
  std::vector<float> buffer(kBlockFrames * kChannels);
  double peak = 0.0;
  for (int64_t rendered = 0; rendered < hi + kBlockFrames;
       rendered += kBlockFrames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    const int64_t block_lo = std::max<int64_t>(0, lo - rendered);
    const int64_t block_hi = std::min<int64_t>(kBlockFrames - 1, hi - rendered);
    if (block_lo <= block_hi) {
      peak = std::max(
          peak,
          BlockPeak(
              buffer,
              static_cast<uint32_t>(block_lo),
              static_cast<uint32_t>(block_hi) + 1
          )
      );
    }
  }
  return peak;
}

// A click's envelope only decays, so across blocks where no tick is due a peak
// that rises is a second voice firing — the one signature of a re-fired tick.
inline void ExpectDecayingBlocks(
    const std::vector<double>& peaks,
    size_t from,
    size_t to,
    const char* label
) {
  Check(peaks.size() >= to, label);
  for (size_t i = from + 1; i < to && i < peaks.size(); ++i) {
    if (peaks[i] >= peaks[i - 1]) {
      std::fprintf(
          stderr,
          "FAIL: %s — block %zu peak %.4f did not decay from %.4f\n",
          label,
          i,
          peaks[i],
          peaks[i - 1]
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
void RunAnchorTests();

}  // namespace metronome_test

#endif  // KITBAG_TOOLS_METRONOME_METRONOME_TEST_SUPPORT_H
