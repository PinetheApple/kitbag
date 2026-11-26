#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <limits>
#include <vector>

#include "abi_test_engine_clock.h"
#include "abi_test_grid_beats.h"
#include "abi_test_render.h"
#include "check.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr uint32_t kBlockFrames = 64;
constexpr int kBeats = 8;
constexpr double kFirstBeatSec = 0.25;
constexpr double kIntervalSec = 0.5;
constexpr double kSongPosSec = 0.5;
constexpr double kDoubleSpeed = 2.0;
constexpr double kLatencyMs = 100.0;
constexpr double kMsPerSecond = 1000.0;
constexpr double kSecondsPerMinute = 60.0;
constexpr uint64_t kAnchorFrame = 4800;
constexpr int64_t kSearchFrames = 48000;
constexpr int64_t kNoClick = -1;
// A voice starts at phase 0, so the frame it triggers on is still silent.
constexpr int64_t kSilentTriggerFrames = 1;
constexpr double kBpmTolerance = 1e-6;
constexpr double kNaN = std::numeric_limits<double>::quiet_NaN();

std::vector<double> Beats(double sample_rate) {
  return GridBeats(sample_rate, kFirstBeatSec, kIntervalSec, kBeats);
}

kb_engine* GridEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  return engine;
}

kb_result SetGrid(kb_engine* engine) {
  const std::vector<double> beats = Beats(kb_engine_sample_rate(engine));
  return kb_metronome_set_grid(
      engine,
      beats.data(),
      static_cast<int32_t>(beats.size()),
      nullptr,
      0,
      0
  );
}

int64_t FirstSoundingFrame(kb_engine* engine) {
  for (int64_t at = 0; at < kSearchFrames; at += kBlockFrames) {
    const std::vector<float> out = Render(engine, kBlockFrames);
    for (uint32_t i = 0; i < kBlockFrames; ++i) {
      if (out[static_cast<size_t>(i) * kChannels] != 0.0F) return at + i;
    }
  }
  return kNoClick;
}

void TestStartsOnTheMappedBeat() {
  kb_engine* engine = GridEngine();
  if (engine == nullptr) return;
  const double rate = kb_engine_sample_rate(engine);
  kb_metronome_set_latency_offset(engine, kLatencyMs);
  const bool set = SetGrid(engine) == KB_OK;
  kb_metronome_anchor_grid(engine, kSongPosSec, kAnchorFrame, kDoubleSpeed);
  const double beat = Beats(rate)[1];
  const double trigger =
      static_cast<double>(kAnchorFrame) +
      ((beat - kSongPosSec) / kDoubleSpeed - kLatencyMs / kMsPerSecond) * rate;
  const int64_t sounding = FirstSoundingFrame(engine);
  const double bpm = kb_metronome_current_bpm(engine);
  kb_engine_destroy(engine);
  Check(
      set && sounding == static_cast<int64_t>(std::ceil(trigger)) +
                             kSilentTriggerFrames,
      "anchor_grid: starts the click on the first grid beat after song_pos, "
      "at_frame + (t - song_pos) / rate, less the latency offset"
  );
  Check(
      std::fabs(bpm - kSecondsPerMinute * kDoubleSpeed / kIntervalSec) <=
          kBpmTolerance,
      "anchor_grid: current_bpm reads the grid's tempo times the rate"
  );
}

bool StaysStopped(kb_engine* engine) {
  Render(engine, kBlockFrames);
  const bool stopped = kb_metronome_is_running(engine) == 0;
  kb_engine_destroy(engine);
  return stopped;
}

void TestDropsAnchorWithoutItsGrid() {
  kb_engine* bare = GridEngine();
  if (bare == nullptr) return;
  kb_metronome_anchor_grid(bare, kSongPosSec, 0, kDoubleSpeed);
  Check(StaysStopped(bare), "anchor_grid: with no grid set it is dropped");
  kb_engine* stale = GridEngine();
  if (stale == nullptr) return;
  SetGrid(stale);
  kb_metronome_anchor_grid(stale, kSongPosSec, 0, kDoubleSpeed);
  SetGrid(stale);
  Check(
      StaysStopped(stale),
      "anchor_grid: one made before the latest set_grid is dropped"
  );
}

void TestDropsBadArguments() {
  const double bad[][2] = {
      {kSongPosSec, 0.0},
      {kSongPosSec, -kDoubleSpeed},
      {kSongPosSec, kNaN},
      {kNaN, kDoubleSpeed},
  };
  bool dropped = true;
  for (const auto& args : bad) {
    kb_engine* engine = GridEngine();
    if (engine == nullptr) return;
    SetGrid(engine);
    kb_metronome_anchor_grid(engine, args[0], 0, args[1]);
    dropped &= StaysStopped(engine);
  }
  Check(
      dropped,
      "anchor_grid: a non-finite position or a rate that is not finite and "
      "positive is dropped"
  );
}

}  // namespace

void RunGridAnchorAbiTests() {
  TestStartsOnTheMappedBeat();
  TestDropsAnchorWithoutItsGrid();
  TestDropsBadArguments();
  RunGridDownbeatAbiTests();
}

}  // namespace abi_test
