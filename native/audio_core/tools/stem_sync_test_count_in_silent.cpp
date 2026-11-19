#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "metronome/metronome.h"
#include "stem_sync_count_in.h"

namespace stem_sync {
namespace {

using click_take::DetectClicks;
using click_take::Peak;
using click_take::SameClicks;
using count_in::CountClicks;
using count_in::CountIn;
using count_in::FirstStem;
using count_in::GridClick;
using count_in::kClickOff;
using count_in::kHalfFrame;
using count_in::kNotFound;
using count_in::kSafetyFrames;
using count_in::kSettleBlocks;
using count_in::kStartBeat;
using count_in::OpenEngine;
using count_in::PlanStart;
using count_in::RenderUntil;
using count_in::Start;
using kitbag_test::Check;

constexpr size_t kSilentBeats = 4;
constexpr size_t kLaterClicks = 2;
constexpr size_t kPauseAfter = 3;

struct SilentRun {
  Start start;
  Take take;
  bool queued = false;
  bool running_after = true;
  bool counting_after = true;
  int64_t click_on_at = 0;
};

kb_engine* OpenClickOff(const std::string& ramp, Take* take, Start* start) {
  kb_engine* engine = OpenEngine(ramp, kitbag::kUnityRate);
  if (engine == nullptr) return nullptr;
  kb_metronome_stop(engine);
  RenderPaced(engine, take, kSettleBlocks);
  *start = PlanStart(engine, kitbag::kUnityRate);
  return engine;
}

int64_t SongClick(const Start& start, size_t beat) {
  return GridClick(start.end, start.head, start.rate, Beats()[beat]);
}

int64_t ClickOnFrame(const Start& start) {
  constexpr size_t kBeat = kStartBeat + kSilentBeats;
  return (SongClick(start, kBeat) + SongClick(start, kBeat + 1)) / 2;
}

SilentRun RunSilentStart(const std::string& ramp) {
  SilentRun run;
  kb_engine* engine = OpenClickOff(ramp, &run.take, &run.start);
  if (engine == nullptr) return run;
  run.queued = CountIn(engine, run.start, kClickOff);
  run.click_on_at = ClickOnFrame(run.start);
  RenderUntil(engine, &run.take, run.click_on_at - 1);
  run.running_after = kb_metronome_is_running(engine) != 0;
  run.counting_after = kb_metronome_counting_in(engine) != 0;
  kb_metronome_start(engine);
  const size_t last = kStartBeat + kSilentBeats + kLaterClicks;
  RenderUntil(engine, &run.take, SongClick(run.start, last));
  kb_engine_destroy(engine);
  return run;
}

std::vector<int64_t> LaterClicks(const Start& start) {
  std::vector<int64_t> clicks;
  for (size_t i = 1; i <= kLaterClicks; ++i) {
    clicks.push_back(SongClick(start, kStartBeat + kSilentBeats + i));
  }
  return clicks;
}

void CheckSongStartsOnEnd(const SilentRun& run) {
  const int64_t first = FirstStem(run.take);
  const auto at = static_cast<size_t>(std::max<int64_t>(first, 0));
  const double stem =
      at < run.take.left.size() ? run.take.left[at] - run.take.right[at] : -1.0;
  Check(
      first == run.start.end &&
          std::fabs(stem - static_cast<double>(run.start.head)) <= kHalfFrame,
      "count-in click off: the song starts on the end frame at the head"
  );
  if (first != run.start.end) {
    std::fprintf(stderr, "  first %lld\n", static_cast<long long>(first));
  }
}

void TestSilentStart(const std::string& ramp) {
  const SilentRun run = RunSilentStart(ramp);
  std::vector<int64_t> count;
  std::vector<int64_t> later;
  for (int64_t click : DetectClicks(run.take.right)) {
    (click < run.start.end ? count : later).push_back(click);
  }
  Check(
      run.queued && SameClicks(count, CountClicks(run.start)),
      "count-in click off: the count sounds on its beats"
  );
  const float quiet = Peak(
      run.take.right,
      static_cast<size_t>(run.start.end),
      static_cast<size_t>(run.click_on_at)
  );
  Check(quiet == 0.0f, "count-in click off: no click from the end frame");
  if (quiet != 0.0f) std::fprintf(stderr, "  peak %g\n", quiet);
  Check(
      !run.running_after && !run.counting_after,
      "count-in click off: the click reads stopped after the count"
  );
  CheckSongStartsOnEnd(run);
  Check(
      SameClicks(later, LaterClicks(run.start)),
      "count-in click off: a click turned on later locks to the song"
  );
}

void TestSilentCountLeavesNoIntent(const std::string& ramp) {
  Take take;
  Start start;
  kb_engine* engine = OpenClickOff(ramp, &take, &start);
  if (engine == nullptr) return;
  const bool queued = CountIn(engine, start, kClickOff);
  RenderUntil(engine, &take, start.end + kSafetyFrames);
  kb_mixer_stop(engine);
  RenderPaced(engine, &take, 1);
  const bool idle = kb_engine_idle(engine) != 0;
  const kb_result rig = kb_rig_click_start(
      engine,
      kitbag::Metronome::kDefaultBpm,
      kitbag::Metronome::kMinSubdivision,
      0
  );
  kb_engine_destroy(engine);
  Check(
      queued && idle && rig == KB_OK,
      "count-in click off: once the song stops the engine idles, rig click free"
  );
}

void TestPauseThenStandaloneStart(const std::string& ramp) {
  Take take;
  Start start;
  kb_engine* engine = OpenClickOff(ramp, &take, &start);
  if (engine == nullptr) return;
  const bool queued = CountIn(engine, start, kClickOff);
  RenderUntil(
      engine,
      &take,
      CountClicks(start)[kPauseAfter - 1] + kSafetyFrames
  );
  kb_metronome_pause(engine);
  kb_mixer_pause(engine);
  RenderUntil(engine, &take, start.end + kSafetyFrames);
  kb_metronome_follow_mixer(engine, 0);
  kb_metronome_clear_grid(engine);
  const auto restart = static_cast<int64_t>(take.right.size());
  kb_metronome_start(engine);
  RenderUntil(engine, &take, restart + kSafetyFrames);
  kb_engine_destroy(engine);
  const std::vector<int64_t> clicks = DetectClicks(take.right);
  Check(
      queued && FirstStem(take) == kNotFound &&
          clicks.size() == kPauseAfter + 1 && clicks.back() == restart,
      "count-in click off: a pause mid-count, then a standalone start clicks"
  );
}

}  // namespace

void RunSilentCountInTests(const std::string& ramp) {
  TestSilentStart(ramp);
  TestSilentCountLeavesNoIntent(ramp);
  TestPauseThenStandaloneStart(ramp);
}

}  // namespace stem_sync
