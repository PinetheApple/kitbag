#ifndef KITBAG_TOOLS_ANALYSIS_CONSTANT_TEMPO_FIXTURES_H
#define KITBAG_TOOLS_ANALYSIS_CONSTANT_TEMPO_FIXTURES_H

#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace beat_tracker_test {

constexpr double kSecondsPerMinute = 60.0;
constexpr float kSentinelBpm = 77.0f;
constexpr double kSentinelAnchor = 7.7;
constexpr int32_t kSentinelBar = 7;
constexpr int32_t kCommonBar = 4;

constexpr uint32_t kLcgMultiplier = 1664525u;
constexpr uint32_t kLcgIncrement = 1013904223u;
constexpr double kLcgRange = 4294967296.0;

struct Fit {
  kb_result status = KB_ERROR_INTERNAL;
  float bpm = kSentinelBpm;
  double anchor = kSentinelAnchor;
  int32_t beats_per_bar = kSentinelBar;
};

inline Fit
RunFit(const std::vector<float>& beats, const std::vector<int32_t>& downbeats) {
  Fit fit;
  fit.status = kb_fit_constant_tempo(
      beats.data(),
      static_cast<int32_t>(beats.size()),
      downbeats.empty() ? nullptr : downbeats.data(),
      static_cast<int32_t>(downbeats.size()),
      &fit.bpm,
      &fit.anchor,
      &fit.beats_per_bar
  );
  return fit;
}

inline double Period(double bpm) {
  return kSecondsPerMinute / bpm;
}

/// How far apart two grids are on the beat nearest `time`, counted on `want`.
inline double GridErrorAt(
    double time,
    double bpm,
    double anchor,
    double want_bpm,
    double want_anchor
) {
  const double beat = std::round((time - want_anchor) / Period(want_bpm));
  return std::fabs(
      (anchor + beat * Period(bpm)) - (want_anchor + beat * Period(want_bpm))
  );
}

struct ClickSpec {
  double first_sec;
  double bpm;
  int count;
  double jitter_sec;
};

// Mirrored by the StemDeck golden script, so both fits read the same floats.
inline std::vector<float> Click(const ClickSpec& spec) {
  uint32_t state = 1;
  std::vector<float> beats;
  for (int k = 0; k < spec.count; ++k) {
    state = state * kLcgMultiplier + kLcgIncrement;
    const double unit = 2.0 * (state / kLcgRange) - 1.0;
    beats.push_back(
        static_cast<float>(
            spec.first_sec + k * Period(spec.bpm) + unit * spec.jitter_sec
        )
    );
  }
  return beats;
}

inline std::vector<int32_t> EveryNth(int32_t step, int32_t first, size_t end) {
  std::vector<int32_t> out;
  for (auto k = static_cast<size_t>(first); k < end; k += step) {
    out.push_back(static_cast<int32_t>(k));
  }
  return out;
}

struct Grid {
  std::vector<float> beats;
  std::vector<int32_t> downbeats;
};

constexpr int kDragSteadyBeats = 120;
constexpr int kDragBeats = 40;
constexpr double kDragStartSec = 0.5;
constexpr double kDragEndSec = 0.74;

/// Steady 0.5 s beats, then an outro whose gaps stretch to 0.74 s.
inline std::vector<float> DraggingOutro() {
  std::vector<float> beats{0.0f};
  for (int k = 1; k < kDragSteadyBeats + kDragBeats; ++k) {
    const double drag = std::max(0, k - kDragSteadyBeats) / double{kDragBeats};
    const double gap = kDragStartSec + drag * (kDragEndSec - kDragStartSec);
    beats.push_back(static_cast<float>(beats.back() + gap));
  }
  return beats;
}

struct ExtraBeats {
  int first;
  int end;
  int every;
  double offset_periods;
};

/// A click with an extra beat offset_periods after each chosen one, and a
/// downbeat on every fourth click beat.
inline Grid WithExtras(const ClickSpec& spec, const ExtraBeats& extra) {
  Grid grid;
  const std::vector<float> click = Click(spec);
  for (int k = 0; k < spec.count; ++k) {
    if (k % kCommonBar == 0) {
      grid.downbeats.push_back(static_cast<int32_t>(grid.beats.size()));
    }
    grid.beats.push_back(click[k]);
    if (k >= extra.first && k < extra.end &&
        (k - extra.first) % extra.every == 0) {
      grid.beats.push_back(
          static_cast<float>(click[k] + extra.offset_periods * Period(spec.bpm))
      );
    }
  }
  return grid;
}

}  // namespace beat_tracker_test

#endif  // KITBAG_TOOLS_ANALYSIS_CONSTANT_TEMPO_FIXTURES_H
