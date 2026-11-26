// The engine's own frame clock against RtPublisher's retire queue. Built twice:
// plainly, and under ThreadSanitizer, where the race test is the ordering check.
#include <atomic>
#include <cstdio>
#include <memory>
#include <thread>
#include <vector>

#include "check.h"
#include "engine.h"
#include "media/streaming_track.h"
#include "rt/monotonic_clock.h"
#include "rt/rt_publisher.h"

namespace {

using kitbag::BeatGrid;
using kitbag::Engine;
using kitbag_test::Check;

constexpr int kExpectedChecks = 6;
constexpr uint32_t kBlock = 113;
constexpr uint64_t kGrace = kitbag::RtPublisher<BeatGrid>::kReclaimGraceFrames;
constexpr uint64_t kBlocksPerGrace = kGrace / kBlock;
constexpr uint64_t kBlocksShortOfGrace =
    kBlocksPerGrace > 0 ? kBlocksPerGrace - 1 : 0;
constexpr int kLeadBlocks = 7;
constexpr uint32_t kRaceBlock = kitbag::StreamingTrack::kMaxBlockFrames;
constexpr uint64_t kRaceBlocksPerGrace = kGrace / kRaceBlock;
constexpr int kRaceBlocks = 300;
// Dates land a block apart, so a closed grace window spans one more than it
// divides into, plus the node retired after that publish's Collect.
constexpr uint64_t kMostHeldInRace = kRaceBlocksPerGrace + 2;
constexpr int kGridBeats = 64;
constexpr double kBeatSec = 0.37;
constexpr double kSaltSec = 1e-4;

std::unique_ptr<BeatGrid> MakeGrid(int salt) {
  auto grid = std::make_unique<BeatGrid>();
  for (int i = 0; i < kGridBeats; ++i) {
    grid->beat_times_sec.push_back(kBeatSec * i + kSaltSec * salt);
  }
  return grid;
}

void RenderBlocks(Engine* engine, uint64_t blocks, uint32_t width = kBlock) {
  std::vector<float> out(static_cast<size_t>(width) * Engine::kChannelCount);
  for (uint64_t b = 0; b < blocks; ++b) {
    engine->RenderOffline(out.data(), width, kitbag::MonotonicNs());
  }
}

void Publish(Engine* engine, int salt) {
  engine->metronome().SetGrid(MakeGrid(salt), engine->frame_clock(), true);
}

void TestGraceOnTheEngineClock() {
  Engine engine;
  engine.metronome().Start();
  RenderBlocks(&engine, kLeadBlocks);
  Publish(&engine, 0);
  Publish(&engine, 1);
  RenderBlocks(&engine, kBlocksShortOfGrace);
  Publish(&engine, 2);
  Check(
      engine.metronome().retired_grids() == 2,
      "grace: a grid outlives a grace window short of a block of rendering"
  );
  RenderBlocks(&engine, 2);
  Publish(&engine, 3);
  Check(
      engine.metronome().retired_grids() == 2,
      "grace: and is freed once the callback has rendered past the window"
  );
}

struct Race {
  Engine engine;
  std::atomic<bool> done{false};
  int publishes = 0;
  size_t most_retired = 0;
};

void RenderRace(Race* race) {
  RenderBlocks(&race->engine, kRaceBlocks, kRaceBlock);
  race->done.store(true, std::memory_order_release);
}

void PublishRace(Race* race) {
  while (!race->done.load(std::memory_order_acquire)) {
    Publish(&race->engine, race->publishes++);
    const uint64_t dated = race->engine.frame_clock().Now();
    race->most_retired =
        std::max(race->most_retired, race->engine.metronome().retired_grids());
    while (race->engine.frame_clock().Now() == dated &&
           !race->done.load(std::memory_order_acquire)) {
      std::this_thread::yield();
    }
  }
}

void TestGridSwapsRaceTheCallback() {
  Race race;
  std::thread render(RenderRace, &race);
  PublishRace(&race);
  render.join();
  const size_t retired = race.engine.metronome().retired_grids();
  std::printf(
      "  race: %d grids published against %d blocks, %zu held at most\n",
      race.publishes,
      kRaceBlocks,
      race.most_retired
  );
  Check(
      race.publishes > static_cast<int>(2 * kRaceBlocksPerGrace),
      "race: grids were swapped across several grace windows"
  );
  Check(
      retired + 1 < static_cast<size_t>(race.publishes),
      "race: grids were freed while the callback was rendering"
  );
  Check(
      race.most_retired <= kMostHeldInRace,
      "race: the retire queue stays within one grace window of swaps"
  );
  race.engine.metronome().ReleaseRetired();
  Check(
      race.engine.metronome().retired_grids() == 0,
      "race: a quiescent release frees the rest"
  );
}

}  // namespace

#if defined(__SANITIZE_THREAD__)
// A grace window of rendering outlives TSan's default per-thread history, and a
// race whose earlier access has been forgotten is dropped, not reported.
extern "C" __attribute__((visibility("default"))) const char*
__tsan_default_options() {
  return "history_size=7";
}
#endif

int main() {
  TestGraceOnTheEngineClock();
  TestGridSwapsRaceTheCallback();
  if (kitbag_test::g_checks != kExpectedChecks) {
    std::fprintf(
        stderr,
        "retire_race_verify: ran %d checks, expected %d\n",
        kitbag_test::g_checks,
        kExpectedChecks
    );
    return 1;
  }
  if (kitbag_test::g_failures == 0) {
    std::printf("retire_race_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(
      stderr,
      "retire_race_verify: %d failure(s)\n",
      kitbag_test::g_failures
  );
  return 1;
}
