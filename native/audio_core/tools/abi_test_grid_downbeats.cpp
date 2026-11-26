#include "kitbag_api.h"

#include <cstdint>
#include <vector>

#include "abi_test_engine_clock.h"
#include "abi_test_render.h"
#include "check.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr uint32_t kBlockFrames = 64;
constexpr int kBeats = 12;
constexpr double kIntervalSec = 0.5;
constexpr double kLockSongSec = 1.0;
constexpr double kRealTime = 1.0;
constexpr double kAfterOldDownbeatSec = 1.01;
constexpr double kAfterNextBeatSec = 1.51;
constexpr int32_t kOldTable[] = {0, 4, 8};
constexpr int32_t kNewTable[] = {1, 5, 9};
constexpr int32_t kTableSize = 3;
constexpr int32_t kOldDownbeatInNewBar = 3;
constexpr int32_t kNewDownbeatPosition = 0;

// Half a sample in keeps every beat off a rounding boundary.
std::vector<double> Beats(double sample_rate) {
  std::vector<double> beats;
  beats.reserve(kBeats);
  for (int i = 0; i < kBeats; ++i) {
    beats.push_back(kIntervalSec * i + 0.5 / sample_rate);
  }
  return beats;
}

kb_engine* LockedEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  const std::vector<double> beats = Beats(kb_engine_sample_rate(engine));
  kb_metronome_set_grid(engine, beats.data(), kBeats, kOldTable, kTableSize, 0);
  kb_metronome_anchor_grid(engine, kLockSongSec, 0, kRealTime);
  return engine;
}

void RenderUntil(kb_engine* engine, double seconds, int64_t* rendered) {
  const double end = seconds * kb_engine_sample_rate(engine);
  while (static_cast<double>(*rendered) < end) {
    Render(engine, kBlockFrames);
    *rendered += kBlockFrames;
  }
}

void TestRefusesWithoutAGrid() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  const kb_result result =
      kb_metronome_set_grid_downbeats(engine, kNewTable, kTableSize);
  kb_engine_destroy(engine);
  Check(
      result == KB_ERROR_INVALID_ARGUMENT,
      "set_grid_downbeats: refused with no grid set"
  );
}

void TestRefusesBadTables() {
  kb_engine* engine = LockedEngine();
  if (engine == nullptr) return;
  const int32_t past_end[] = {kBeats};
  const int32_t descending[] = {4, 1};
  const bool refused = kb_metronome_set_grid_downbeats(engine, past_end, 1) ==
                           KB_ERROR_INVALID_ARGUMENT &&
                       kb_metronome_set_grid_downbeats(engine, descending, 2) ==
                           KB_ERROR_INVALID_ARGUMENT &&
                       kb_metronome_set_grid_downbeats(engine, nullptr, 1) ==
                           KB_ERROR_INVALID_ARGUMENT &&
                       kb_metronome_set_grid_downbeats(engine, kNewTable, -1) ==
                           KB_ERROR_INVALID_ARGUMENT;
  kb_engine_destroy(engine);
  Check(refused, "set_grid_downbeats: refuses tables set_grid would refuse");
}

void TestShiftRebarsInPlace() {
  kb_engine* engine = LockedEngine();
  if (engine == nullptr) return;
  int64_t rendered = 0;
  RenderUntil(engine, kAfterOldDownbeatSec, &rendered);
  const bool shifted =
      kb_metronome_set_grid_downbeats(engine, kNewTable, kTableSize) == KB_OK;
  Render(engine, kBlockFrames);
  rendered += kBlockFrames;
  const int32_t rebarred = kb_metronome_current_beat(engine);
  RenderUntil(engine, kAfterNextBeatSec, &rendered);
  const int32_t next = kb_metronome_current_beat(engine);
  const bool running = kb_metronome_is_running(engine) != 0;
  kb_engine_destroy(engine);
  Check(
      shifted && running && rebarred == kOldDownbeatInNewBar &&
          next == kNewDownbeatPosition,
      "set_grid_downbeats: the current beat is re-read in the new bars at once "
      "and the next downbeat lands on the new table"
  );
}

}  // namespace

void RunGridDownbeatAbiTests() {
  TestRefusesWithoutAGrid();
  TestRefusesBadTables();
  TestShiftRebarsInPlace();
}

}  // namespace abi_test
