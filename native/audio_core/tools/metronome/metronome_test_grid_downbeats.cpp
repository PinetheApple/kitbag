#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <span>
#include <vector>

#include "grid_beat_phase.h"
#include "kitbag_metronome_grid_api.h"
#include "metronome/grid_bars.h"
#include "metronome/grid_state.h"
#include "metronome_test_audio.h"
#include "test_clock.h"
#include "zero_clock.h"

namespace metronome_test {
namespace {

using kitbag::GridBar;
using kitbag::GridMapping;
using kitbag_test::ClockAt;
using kitbag_test::kZeroClock;

constexpr int kDownbeatGridBeats = 12;
constexpr double kIntervalSec = 0.5;
constexpr double kLockSongSec = 1.0;
constexpr int64_t kRenderFrames = int64_t{4} * kSampleRate;
constexpr double kSampleTolerance = 1e-6;
constexpr int64_t kNoMismatch = -1;
constexpr int kFirstHeardBeat = 2;
constexpr int kEighths = 2;

constexpr int32_t kOnTheOne[] = {0, 4, 8};
constexpr int32_t kOneLater[] = {1, 5, 9};

struct Shift {
  const char* name;
  double at_sec;
  std::span<const int32_t> from;
  std::span<const int32_t> to;
  int32_t rate = KB_GRID_RATE_SINGLE;
  int subdivision = 1;
};

const Shift kShifts[] = {
    {"one beat later, 10 ms after a beat", 2.010, kOnTheOne, kOneLater},
    {"one beat later, 10 ms before the old downbeat",
     2.990,
     kOnTheOne,
     kOneLater},
    {"to no downbeats, 10 ms after a beat", 2.010, kOnTheOne, {}},
    {"x1/2 x2, one beat later, 10 ms after an off-beat",
     1.510,
     kOnTheOne,
     kOneLater,
     KB_GRID_RATE_HALF,
     kEighths},
    {"x1/2 x2, to no downbeats, 10 ms after an off-beat",
     2.010,
     kOneLater,
     {},
     KB_GRID_RATE_HALF,
     kEighths},
};

enum class Role : uint8_t { kNormal, kAccent, kSubdivision };
constexpr Role kRoles[] = {Role::kNormal, Role::kAccent, Role::kSubdivision};

struct Click {
  int64_t frame;
  Role role;
};

int64_t TargetFrame(double at_sec) {
  return static_cast<int64_t>(std::ceil(at_sec * kSampleRate));
}

int64_t SwapFrame(double at_sec) {
  return (TargetFrame(at_sec) + kBlockFrames - 1) / kBlockFrames * kBlockFrames;
}

int64_t BeatFrame(int beat) {
  const double song = kBeatPhaseSec + kIntervalSec * beat;
  return static_cast<int64_t>(std::ceil((song - kLockSongSec) * kSampleRate));
}

// Under x1/2 an off-beat is silent and its span's middle tick sounds on it.
Role RoleOf(std::span<const int32_t> table, int32_t rate, int beat) {
  const std::vector<GridBar> bars = kitbag::GridBars(table, kDownbeatGridBeats);
  const GridBar& bar = bars[static_cast<size_t>(beat)];
  const int counted = table.empty() ? beat : bar.position;
  if (rate == KB_GRID_RATE_HALF && counted % 2 != 0) return Role::kSubdivision;
  const bool downbeat = bar.bar != GridBar::kNoBar && bar.position == 0;
  return downbeat ? Role::kAccent : Role::kNormal;
}

std::vector<Click> ExpectedClicks(const Shift& shift, bool shifts) {
  const int64_t swap = shifts ? SwapFrame(shift.at_sec) : kRenderFrames;
  std::vector<Click> clicks;
  clicks.reserve(kDownbeatGridBeats);
  for (int beat = kFirstHeardBeat; beat < kDownbeatGridBeats; ++beat) {
    const int64_t frame = BeatFrame(beat);
    const auto table = frame < swap ? shift.from : shift.to;
    clicks.push_back({frame, RoleOf(table, shift.rate, beat)});
  }
  return clicks;
}

void Lock(kitbag::Metronome& metronome, const Shift& shift) {
  auto grid = MakeShiftedGrid(kDownbeatGridBeats, kBeatPhaseSec, kIntervalSec);
  grid->bars = kitbag::GridBars(shift.from, kDownbeatGridBeats);
  metronome.SetSubdivision(shift.subdivision);
  metronome.SetGrid(std::move(grid), kZeroClock, true);
  metronome.SetGridRate(shift.rate);
  metronome.AnchorGrid(kLockSongSec, 0, GridMapping::kRealTime);
}

std::vector<float> RenderShifted(const Shift& shift, bool* published) {
  kitbag::Metronome metronome;
  Lock(metronome, shift);
  return RenderLeft(
      metronome,
      kRenderFrames,
      OnceAtFrame(TargetFrame(shift.at_sec), [&](int64_t at) {
        *published = metronome.SetGridDownbeats(shift.to, ClockAt(at), true);
      })
  );
}

std::vector<float> RenderedBeat(const std::vector<float>& left, int beat) {
  return {left.begin() + BeatFrame(beat), left.begin() + BeatFrame(beat + 1)};
}

std::vector<std::vector<float>> RoleWaves(const Shift& shift) {
  kitbag::Metronome reference;
  Lock(reference, shift);
  const std::vector<float> unshifted = RenderLeft(reference, kRenderFrames);
  const std::vector<Click> clicks = ExpectedClicks(shift, false);
  std::vector<std::vector<float>> waves;
  for (const Role role : kRoles) {
    const auto first = std::find_if(clicks.begin(), clicks.end(), [&](auto c) {
      return c.role == role;
    });
    const int beat = kFirstHeardBeat + static_cast<int>(first - clicks.begin());
    waves.push_back(
        first == clicks.end() ? std::vector<float>{}
                              : RenderedBeat(unshifted, beat)
    );
  }
  return waves;
}

std::vector<double> Synthesize(const Shift& shift) {
  const std::vector<std::vector<float>> waves = RoleWaves(shift);
  std::vector<double> expected(static_cast<size_t>(kRenderFrames), 0.0);
  for (const Click& click : ExpectedClicks(shift, true)) {
    const std::vector<float>& wave = waves[static_cast<size_t>(click.role)];
    for (size_t i = 0; i < wave.size(); ++i) {
      const size_t at = static_cast<size_t>(click.frame) + i;
      if (at < expected.size()) expected[at] += wave[i];
    }
  }
  return expected;
}

int64_t FirstMismatch(
    const std::vector<float>& rendered,
    const std::vector<double>& expected
) {
  for (size_t i = 0; i < expected.size() && i < rendered.size(); ++i) {
    if (std::fabs(rendered[i] - expected[i]) > kSampleTolerance) {
      return static_cast<int64_t>(i);
    }
  }
  return kNoMismatch;
}

void ReportMismatch(const Shift& shift, size_t rendered, size_t expected) {
  if (rendered != expected) {
    std::fprintf(
        stderr,
        "  %s: rendered %zu samples, expected %zu\n",
        shift.name,
        rendered,
        expected
    );
  }
}

void TestShiftMovesOnlyTheAccent(const Shift& shift) {
  bool published = false;
  const std::vector<float> rendered = RenderShifted(shift, &published);
  const std::vector<double> expected = Synthesize(shift);
  ReportMismatch(shift, rendered.size(), expected.size());
  const int64_t mismatch = FirstMismatch(rendered, expected);
  if (mismatch != kNoMismatch) {
    std::fprintf(
        stderr,
        "  %s: first wrong sample at %.4f s (frame %lld)\n",
        shift.name,
        static_cast<double>(mismatch) / kSampleRate,
        static_cast<long long>(mismatch)
    );
  }
  Check(
      published && rendered.size() == expected.size() &&
          mismatch == kNoMismatch,
      "set_grid_downbeats: every beat sounds once across the shift and the "
      "accent moves to the new downbeats"
  );
}

}  // namespace

void RunGridDownbeatTests() {
  for (const Shift& shift : kShifts) TestShiftMovesOnlyTheAccent(shift);
}

}  // namespace metronome_test
