#ifndef KITBAG_TOOLS_ANALYSIS_CONSTANT_TEMPO_FIXTURES_H
#define KITBAG_TOOLS_ANALYSIS_CONSTANT_TEMPO_FIXTURES_H

#include "kitbag_api.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

#include "analysis/meter.h"
#include "time_units.h"

namespace beat_tracker_test {

using kitbag::kCommonBeatsPerBar;
using kitbag::kSecondsPerMinute;

constexpr float kSentinelBpm = 77.0f;
constexpr double kSentinelAnchor = 7.7;
constexpr int32_t kSentinelBar = 7;

constexpr uint32_t kLcgMultiplier = 1664525u;
constexpr uint32_t kLcgIncrement = 1013904223u;
constexpr double kLcgRange = 4294967296.0;

struct Fit {
  kb_result status = KB_ERROR_INTERNAL;
  float bpm = kSentinelBpm;
  double anchor = kSentinelAnchor;
  int32_t beats_per_bar = kSentinelBar;
};

inline Fit RunFit(
    const float* beats,
    int32_t beat_count,
    const int32_t* downbeats,
    int32_t downbeat_count
) {
  Fit fit;
  fit.status = kb_fit_constant_tempo(
      beats,
      beat_count,
      downbeats,
      downbeat_count,
      &fit.bpm,
      &fit.anchor,
      &fit.beats_per_bar
  );
  return fit;
}

inline Fit
RunFit(const std::vector<float>& beats, const std::vector<int32_t>& downbeats) {
  return RunFit(
      beats.data(),
      static_cast<int32_t>(beats.size()),
      downbeats.empty() ? nullptr : downbeats.data(),
      static_cast<int32_t>(downbeats.size())
  );
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

constexpr ClickSpec kJitteredClick = {
    .first_sec = 0.3137,
    .bpm = 123.7,
    .count = 240,
    .jitter_sec = 0.012,
};
constexpr int32_t kJitteredFirstDownbeat = 2;

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

inline std::vector<float> WithExtras(
    const std::vector<float>& click,
    double bpm,
    const ExtraBeats& extra
) {
  std::vector<float> beats;
  for (int k = 0; k < static_cast<int>(click.size()); ++k) {
    beats.push_back(click[k]);
    if (k >= extra.first && k < extra.end &&
        (k - extra.first) % extra.every == 0) {
      beats.push_back(
          static_cast<float>(click[k] + extra.offset_periods * Period(bpm))
      );
    }
  }
  return beats;
}

/// Indices into `beats` of every bar-one beat of `click`, which it contains.
inline std::vector<int32_t> ClickDownbeats(
    const std::vector<float>& beats,
    const std::vector<float>& click
) {
  std::vector<int32_t> downbeats;
  size_t next = 0;
  for (size_t i = 0; i < beats.size() && next < click.size(); ++i) {
    if (beats[i] != click[next]) continue;
    if (next % kCommonBeatsPerBar == 0) {
      downbeats.push_back(static_cast<int32_t>(i));
    }
    ++next;
  }
  return downbeats;
}

}  // namespace beat_tracker_test

#endif  // KITBAG_TOOLS_ANALYSIS_CONSTANT_TEMPO_FIXTURES_H
