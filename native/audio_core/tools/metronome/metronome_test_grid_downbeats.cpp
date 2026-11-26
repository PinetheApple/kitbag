#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <span>
#include <vector>

#include "metronome/grid_bars.h"
#include "metronome/grid_state.h"
#include "metronome_test_audio.h"
#include "test_clock.h"
#include "zero_clock.h"

namespace metronome_test {
namespace {

using kitbag::GridMapping;
using kitbag_test::ClockAt;
using kitbag_test::kZeroClock;

constexpr int kDownbeatGridBeats = 12;
constexpr double kIntervalSec = 0.5;
// Half a sample past each beat keeps every fire frame off a rounding boundary.
constexpr double kBeatPhaseSec = 0.5 / kSampleRate;
constexpr double kLockSongSec = 1.0;
constexpr int64_t kRenderFrames = int64_t{4} * kSampleRate;
constexpr double kSampleTolerance = 1e-6;
constexpr int64_t kNoMismatch = -1;
constexpr int kFirstHeardBeat = 2;
constexpr int kFirstAccentedBeat = 4;

constexpr int32_t kOnTheOne[] = {0, 4, 8};
constexpr int32_t kOneLater[] = {1, 5, 9};

struct Shift {
  const char* name;
  double at_sec;
  std::span<const int32_t> downbeats;
};

const Shift kShifts[] = {
    {"one beat later, 10 ms after a beat", 2.010, kOneLater},
    {"one beat later, 10 ms before the old downbeat", 2.990, kOneLater},
    {"to no downbeats, 10 ms after a beat", 2.010, {}},
};

struct Click {
  int64_t frame;
  bool accent;
};

int64_t SwapFrame(double at_sec) {
  const auto target = static_cast<int64_t>(std::ceil(at_sec * kSampleRate));
  return (target + kBlockFrames - 1) / kBlockFrames * kBlockFrames;
}

int64_t BeatFrame(int beat) {
  const double song = kBeatPhaseSec + kIntervalSec * beat;
  return static_cast<int64_t>(std::ceil((song - kLockSongSec) * kSampleRate));
}

bool Contains(std::span<const int32_t> table, int beat) {
  return std::find(table.begin(), table.end(), beat) != table.end();
}

std::vector<Click> ExpectedClicks(const Shift& shift) {
  const int64_t swap = SwapFrame(shift.at_sec);
  std::vector<Click> clicks;
  clicks.reserve(kDownbeatGridBeats);
  for (int beat = kFirstHeardBeat; beat < kDownbeatGridBeats; ++beat) {
    const int64_t frame = BeatFrame(beat);
    const std::span<const int32_t> table =
        frame < swap ? std::span<const int32_t>(kOnTheOne) : shift.downbeats;
    clicks.push_back({frame, Contains(table, beat)});
  }
  return clicks;
}

void Lock(kitbag::Metronome& metronome) {
  auto grid = MakeShiftedGrid(kDownbeatGridBeats, kBeatPhaseSec, kIntervalSec);
  grid->bars = kitbag::GridBars(kOnTheOne, kDownbeatGridBeats);
  metronome.SetGrid(std::move(grid), kZeroClock, true);
  metronome.AnchorGrid(kLockSongSec, 0, GridMapping::kRealTime);
}

std::vector<float> RenderShifted(const Shift& shift) {
  kitbag::Metronome metronome;
  Lock(metronome);
  const auto target =
      static_cast<int64_t>(std::ceil(shift.at_sec * kSampleRate));
  return RenderLeft(
      metronome,
      kRenderFrames,
      OnceAtFrame(target, [&](int64_t at) {
        metronome.SetGridDownbeats(shift.downbeats, ClockAt(at), true);
      })
  );
}

std::vector<float> Canon(const std::vector<float>& left, int beat) {
  const int64_t from = BeatFrame(beat);
  const int64_t to = BeatFrame(beat + 1);
  return {left.begin() + from, left.begin() + to};
}

std::vector<double> Synthesize(const Shift& shift) {
  kitbag::Metronome reference;
  Lock(reference);
  const std::vector<float> unshifted = RenderLeft(reference, kRenderFrames);
  const std::vector<float> accent = Canon(unshifted, kFirstAccentedBeat);
  const std::vector<float> normal = Canon(unshifted, kFirstHeardBeat);
  std::vector<double> expected(static_cast<size_t>(kRenderFrames), 0.0);
  for (const Click& click : ExpectedClicks(shift)) {
    const std::vector<float>& wave = click.accent ? accent : normal;
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

void TestShiftMovesOnlyTheAccent(const Shift& shift) {
  const std::vector<float> rendered = RenderShifted(shift);
  const std::vector<double> expected = Synthesize(shift);
  const bool same_length = rendered.size() == expected.size();
  if (!same_length) {
    std::fprintf(
        stderr,
        "  %s: rendered %zu samples, expected %zu\n",
        shift.name,
        rendered.size(),
        expected.size()
    );
  }
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
      same_length && mismatch == kNoMismatch,
      "set_grid_downbeats: every beat sounds once across the shift and the "
      "accent moves to the new downbeats"
  );
}

}  // namespace

void RunGridDownbeatTests() {
  for (const Shift& shift : kShifts) TestShiftMovesOnlyTheAccent(shift);
}

}  // namespace metronome_test
