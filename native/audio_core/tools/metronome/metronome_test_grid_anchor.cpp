#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"
#include "zero_clock.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kMaxNudgeTicks;
using kitbag_test::kZeroClock;

constexpr int kAnchorGridBeats = 12;
constexpr double kIntervalSec = 0.5;
// Half a sample past each beat keeps every fire frame off a rounding boundary,
// so the model and the engine cannot round one beat to different frames.
constexpr double kBeatPhaseSec = 0.5 / kSampleRate;
constexpr int64_t kRenderFrames = int64_t{4} * kSampleRate;
constexpr double kRealTime = 1.0;
constexpr double kFastRate = 1.25;
constexpr int kEighths = 2;
constexpr double kSampleTolerance = 1e-6;

struct Correction {
  const char* name;
  double at_sec;
  double shift_sec;
  int subdivision = 1;
  double rate = kRealTime;
};

constexpr Correction kCorrections[] = {
    {"same line, 10 ms after a beat", 2.010, 0.0},
    {"-20 ms, 10 ms after a beat", 2.010, -0.020},
    {"-20 ms, 30 ms after a beat", 2.030, -0.020},
    {"-10 ms, 5 ms after a beat", 2.003, -0.010},
    {"-5 ms, 5 ms after a beat", 2.0005, -0.005},
    {"-100 ms, 50 ms after a beat", 2.050, -0.100},
    {"+20 ms, 15 ms before a beat", 2.485, 0.020},
    {"+20 ms, 25 ms before a beat", 2.470, 0.020},
    {"-20 ms x2, 10 ms after a beat", 2.010, -0.020, kEighths},
    {"+20 ms, 10 ms after a beat", 2.010, 0.020},
    {"+300 ms, a seek past a beat", 2.300, 0.300},
    {"back 0.6 s, a seek that replays", 2.100, -0.600},
    {"rate 1.25 from 10 ms after a beat", 2.010, 0.0, 1, kFastRate},
};

struct Click {
  int64_t frame;
  bool beat;
};

int64_t SwapFrame(const Correction& correction) {
  const auto target =
      static_cast<int64_t>(std::ceil(correction.at_sec * kSampleRate));
  return (target + kBlockFrames - 1) / kBlockFrames * kBlockFrames;
}

int64_t FireFrame(double song_sec, double pos_sec, int64_t at, double rate) {
  return at + static_cast<int64_t>(
                  std::ceil((song_sec - pos_sec) * kSampleRate / rate)
              );
}

double TickSec(int tick, int subdivision) {
  return kBeatPhaseSec + kIntervalSec * tick / subdivision;
}

std::vector<Click> ExpectedClicks(const Correction& correction) {
  const int64_t swap = SwapFrame(correction);
  const double next =
      static_cast<double>(swap) / kSampleRate + correction.shift_sec;
  const int sub = correction.subdivision;
  const bool nudge =
      std::fabs(correction.shift_sec) * sub < kMaxNudgeTicks * kIntervalSec;
  const bool replays = correction.shift_sec <= -kIntervalSec;
  std::vector<Click> clicks;
  for (int tick = 0; tick < kAnchorGridBeats * sub; ++tick) {
    const double song = TickSec(tick, sub);
    const int64_t before = FireFrame(song, 0.0, 0, kRealTime);
    const bool fired = before < swap;
    if (fired) clicks.push_back({before, tick % sub == 0});
    if ((fired && !replays) || (!nudge && song < next)) continue;
    const int64_t after = FireFrame(song, next, swap, correction.rate);
    clicks.push_back({std::max(swap, after), tick % sub == 0});
  }
  return clicks;
}

void Lock(kitbag::Metronome& metronome, int subdivision) {
  metronome.SetSubdivision(subdivision);
  metronome.SetGrid(
      MakeShiftedGrid(kAnchorGridBeats, kBeatPhaseSec, kIntervalSec),
      kZeroClock,
      true
  );
  metronome.AnchorGrid(0.0, 0, kRealTime);
}

std::vector<float> RenderCorrected(const Correction& correction) {
  kitbag::Metronome metronome;
  Lock(metronome, correction.subdivision);
  const auto target =
      static_cast<int64_t>(std::ceil(correction.at_sec * kSampleRate));
  return RenderLeft(
      metronome,
      kRenderFrames,
      OnceAtFrame(target, [&](int64_t at) {
        const double song = static_cast<double>(at) / kSampleRate;
        metronome.AnchorGrid(
            song + correction.shift_sec,
            static_cast<uint64_t>(at),
            correction.rate
        );
      })
  );
}

std::vector<float> RenderUnswapped(int subdivision) {
  kitbag::Metronome metronome;
  Lock(metronome, subdivision);
  return RenderLeft(metronome, kRenderFrames);
}

std::vector<float> Canon(const std::vector<float>& left, int tick, int sub) {
  const int64_t from = FireFrame(TickSec(tick, sub), 0.0, 0, kRealTime);
  const int64_t length =
      FireFrame(TickSec(tick + 1, sub), 0.0, 0, kRealTime) - from;
  return {left.begin() + from, left.begin() + from + length};
}

std::vector<double> Synthesize(const Correction& correction) {
  const std::vector<float> unswapped = RenderUnswapped(correction.subdivision);
  const std::vector<float> beat = Canon(unswapped, 0, correction.subdivision);
  const std::vector<float> sub =
      correction.subdivision > 1 ? Canon(unswapped, 1, correction.subdivision)
                                 : beat;
  std::vector<double> expected(static_cast<size_t>(kRenderFrames), 0.0);
  for (const Click& click : ExpectedClicks(correction)) {
    const std::vector<float>& wave = click.beat ? beat : sub;
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
  return rendered.size() == expected.size() ? -1 : 0;
}

void TestCorrectionPlaysEachTickOnce(const Correction& correction) {
  const std::vector<float> rendered = RenderCorrected(correction);
  const int64_t mismatch = FirstMismatch(rendered, Synthesize(correction));
  if (mismatch >= 0) {
    std::fprintf(
        stderr,
        "  %s: first wrong sample at %.4f s (frame %lld)\n",
        correction.name,
        static_cast<double>(mismatch) / kSampleRate,
        static_cast<long long>(mismatch)
    );
  }
  Check(
      mismatch < 0,
      "anchor_grid: a re-anchor while playing sounds every tick the model "
      "expects, sample for sample, and no other"
  );
}

}  // namespace

void RunGridAnchorTests() {
  for (const Correction& correction : kCorrections) {
    TestCorrectionPlaysEachTickOnce(correction);
  }
}

}  // namespace metronome_test
