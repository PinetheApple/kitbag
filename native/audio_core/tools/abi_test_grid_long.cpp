#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <vector>

#include "abi_test_metronome.h"
#include "check.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr int32_t kPre161Cap = 8192;
constexpr int32_t kLongGridBeats = 9100;
static_assert(
    kLongGridBeats > kPre161Cap && kLongGridBeats <= KB_MAX_GRID_BEATS
);
// Unrelated to the 120 BPM constant tempo, so a rejected grid cannot pass.
constexpr double kGridIntervalSec = 0.3127;
constexpr double kConstantBpm = 120.0;
constexpr int32_t kBeatsPerBar = 5;
constexpr int32_t kBeatUnit = 4;
constexpr int32_t kLeadBeats = 8;
constexpr double kTailSec = 3.0;
constexpr uint32_t kBlockFrames = 4096;
constexpr uint32_t kChannels = 2;
constexpr float kOnsetThreshold = 0.05f;
constexpr double kOnsetToleranceSec = 0.002;

struct Window {
  uint64_t first = 0;
  uint64_t end = 0;
};

void RenderSilently(kb_engine* engine, uint64_t frames) {
  std::vector<float> out(static_cast<size_t>(kBlockFrames) * kChannels);
  for (uint64_t done = 0; done < frames; done += kBlockFrames) {
    const uint64_t left = frames - done;
    kb_engine_render(
        engine,
        out.data(),
        static_cast<uint32_t>(left < kBlockFrames ? left : kBlockFrames)
    );
  }
}

std::vector<double>
OnsetSeconds(kb_engine* engine, const Window& window, uint32_t rate) {
  const auto refractory = static_cast<uint64_t>(kGridIntervalSec * rate / 2.0);
  std::vector<float> out(static_cast<size_t>(kBlockFrames) * kChannels);
  std::vector<double> onsets;
  uint64_t last_onset = 0;
  for (uint64_t start = window.first; start < window.end;
       start += kBlockFrames) {
    kb_engine_render(engine, out.data(), kBlockFrames);
    for (uint32_t i = 0; i < kBlockFrames; ++i) {
      const uint64_t frame = start + i;
      const bool loud =
          std::fabs(out[static_cast<size_t>(i) * kChannels]) > kOnsetThreshold;
      if (!loud || (!onsets.empty() && frame - last_onset < refractory)) {
        continue;
      }
      onsets.push_back(static_cast<double>(frame) / rate);
      last_onset = frame;
    }
  }
  return onsets;
}

bool OnsetsMatchGrid(
    const std::vector<double>& onsets,
    const std::vector<double>& grid,
    double from_sec
) {
  size_t next = 0;
  while (next < grid.size() && grid[next] < from_sec) ++next;
  if (onsets.size() != grid.size() - next) return false;
  for (const double onset : onsets) {
    if (std::fabs(onset - grid[next++]) > kOnsetToleranceSec) return false;
  }
  return true;
}

std::vector<double> EvenGrid() {
  std::vector<double> grid(kLongGridBeats);
  for (size_t i = 0; i < grid.size(); ++i) {
    grid[i] = kGridIntervalSec * static_cast<double>(i);
  }
  return grid;
}

void TestGridLocksPastPre161Cap() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  const uint32_t rate = kb_engine_sample_rate(engine);
  kb_metronome_set_tempo(engine, kConstantBpm);
  kb_metronome_set_beats(engine, kBeatsPerBar, kBeatUnit);
  const std::vector<double> grid = EvenGrid();
  Check(
      kb_metronome_set_grid(engine, grid.data(), kLongGridBeats, 0) == KB_OK,
      "long grid: set_grid accepts a grid past the pre-#161 cap"
  );
  kb_metronome_start(engine);
  const double from_sec = grid[kPre161Cap - kLeadBeats] - kGridIntervalSec / 2;
  const Window window{
      static_cast<uint64_t>(from_sec * rate),
      static_cast<uint64_t>((grid.back() + kTailSec) * rate)
  };
  RenderSilently(engine, window.first);
  Check(
      OnsetsMatchGrid(OnsetSeconds(engine, window, rate), grid, from_sec),
      "long grid: past the pre-#161 cap every click lands on its grid beat, "
      "then silence after the last"
  );
  Check(
      kb_metronome_current_beat(engine) == (kLongGridBeats - 1) % kBeatsPerBar,
      "long grid: the bar position past the end is the last grid beat's"
  );
  kb_engine_destroy(engine);
}

}  // namespace

void RunLongGridAbiTests() {
  TestGridLocksPastPre161Cap();
}

}  // namespace abi_test
