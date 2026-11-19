#include <cmath>
#include <cstdio>
#include <span>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "downbeats.h"
#include "grid_click_levels.h"
#include "stem_sync_count_in.h"

namespace stem_sync {
namespace {

using count_in::GridClick;
using count_in::kStartBeat;
using kitbag_test::Check;

constexpr double kSlow = 0.75;
constexpr int32_t kBeepSound = 0;
constexpr int32_t kFirstDownbeat = 1;
constexpr int32_t kSevenBeats = 7;
constexpr int32_t kThreeTwoTwo[] = {3, 2, 2};
constexpr int32_t kTwoTwoThree[] = {2, 2, 3};
constexpr int32_t kTwoOne[] = {2, 1};
// Beat i's level on 7-beat bars from beat 1, grouped 3+2+2.
constexpr char kThreeTwoTwoBeats[] = "nBnnGnGnBnnGnGnBnnGnGnBnnGnGnBnnGnGn";
constexpr size_t kPausedBeat = 10;
constexpr size_t kSeekBeat = 16;
constexpr double kPastHalf = 0.6;
constexpr size_t kLastBeat = 24;
constexpr int kPauseBlocks = 20;
constexpr int64_t kRingFrames = 2400;
constexpr size_t kLoopFirstBeat = 15;
constexpr size_t kLoopLastBeat = 21;
constexpr int64_t kLoopLead = 2000;
constexpr int64_t kLoopTail = 4000;
constexpr int kLoopPasses = 3;

struct Event {
  int64_t frame;
  char level;
};

void SetGridClick(
    kb_engine* engine,
    std::span<const int32_t> groups,
    int32_t rate
) {
  kb_metronome_set_sounds(engine, kBeepSound, kBeepSound);
  kb_metronome_set_grid_grouping(
      engine,
      groups.data(),
      static_cast<int32_t>(groups.size())
  );
  kb_metronome_set_grid_rate(engine, rate);
}

kb_engine* OpenSevenBeatBars(const std::string& stem) {
  kb_engine* engine = count_in::OpenEngine(stem, kSlow);
  if (engine == nullptr) return nullptr;
  std::vector<double> seconds;
  for (double beat : Beats()) seconds.push_back(beat / kSampleRate);
  const std::vector<int32_t> downbeats =
      kitbag_test::EveryNthBeat(kFirstDownbeat, kSevenBeats, kBeatCount);
  kb_metronome_set_grid(
      engine,
      seconds.data(),
      static_cast<int32_t>(seconds.size()),
      downbeats.data(),
      static_cast<int32_t>(downbeats.size()),
      0
  );
  return engine;
}

// Every beat and half from song frame head on, heard from output frame out.
void AddEvents(
    std::vector<Event>* events,
    int64_t out,
    int64_t head,
    int64_t until
) {
  const std::vector<double> beats = Beats();
  for (size_t i = 0; i < beats.size(); ++i) {
    if (beats[i] > static_cast<double>(head)) {
      events->push_back(
          {GridClick(out, head, kSlow, beats[i]), kThreeTwoTwoBeats[i]}
      );
    }
    const double half =
        i + 1 < beats.size() ? (beats[i] + beats[i + 1]) / 2.0 : -1.0;
    if (half > static_cast<double>(head)) {
      events->push_back(
          {GridClick(out, head, kSlow, half), grid_levels::kNormal}
      );
    }
  }
  std::erase_if(*events, [&](const Event& e) { return e.frame >= until; });
}

void ExpectEvents(
    const Take& take,
    const std::vector<Event>& events,
    const std::string& label
) {
  std::string got;
  std::string want;
  for (const Event& e : events) {
    got += grid_levels::LevelAt(take.right, e.frame);
    want += e.level;
  }
  const size_t clicks = click_take::DetectClicks(take.right).size();
  Check(got == want && clicks == events.size(), label.c_str());
  if (got != want || clicks != events.size()) {
    std::fprintf(
        stderr,
        "  got %s (%zu clicks), expected %s\n",
        got.c_str(),
        clicks,
        want.c_str()
    );
  }
}

struct SeekRun {
  Take take;
  int64_t paused_at = 0;
  int64_t seek = 0;
  int64_t resumed_at = 0;
  int64_t end = 0;
};

SeekRun PlayPauseSeek(kb_engine* engine) {
  const std::vector<double> beats = Beats();
  SeekRun run;
  kb_mixer_play(engine);
  count_in::RenderUntil(
      engine,
      &run.take,
      GridClick(0, 0, kSlow, beats[kPausedBeat]) + kRingFrames
  );
  run.paused_at = static_cast<int64_t>(run.take.right.size());
  kb_mixer_pause(engine);
  RenderPaced(engine, &run.take, kPauseBlocks);
  run.seek = std::llround(
      beats[kSeekBeat] + kPastHalf * (beats[kSeekBeat + 1] - beats[kSeekBeat])
  );
  kb_mixer_seek(engine, run.seek);
  run.resumed_at = static_cast<int64_t>(run.take.right.size());
  kb_mixer_play(engine);
  run.end = GridClick(run.resumed_at, run.seek, kSlow, beats[kLastBeat]) + 1;
  count_in::RenderUntil(engine, &run.take, run.end + kRingFrames);
  return run;
}

void TestSeekAtSlowSpeed(const std::string& stem) {
  kb_engine* engine = OpenSevenBeatBars(stem);
  if (engine == nullptr) return;
  SetGridClick(engine, kThreeTwoTwo, KB_GRID_RATE_DOUBLE);
  const SeekRun run = PlayPauseSeek(engine);
  kb_engine_destroy(engine);
  std::vector<Event> events;
  AddEvents(&events, 0, 0, run.paused_at);
  std::vector<Event> resumed;
  AddEvents(&resumed, run.resumed_at, run.seek, run.end);
  events.insert(events.end(), resumed.begin(), resumed.end());
  ExpectEvents(
      run.take,
      events,
      "grid grouping: 3+2+2 at x2 holds through a seek at 0.75x"
  );
}

void ExpectLevels(
    const std::string& got,
    const std::string& want,
    const std::string& label
) {
  Check(got == want, label.c_str());
  if (got != want) {
    std::fprintf(stderr, "  got %s, expected %s\n", got.c_str(), want.c_str());
  }
}

std::string LoopLevels(
    const std::string& stem,
    std::span<const int32_t> groups,
    int32_t rate
) {
  kb_engine* engine = OpenSevenBeatBars(stem);
  if (engine == nullptr) return "";
  SetGridClick(engine, groups, rate);
  const std::vector<double> beats = Beats();
  const auto start = static_cast<int64_t>(beats[kLoopFirstBeat]) - kLoopLead;
  const auto end = static_cast<int64_t>(beats[kLoopLastBeat]) + kLoopTail;
  kb_mixer_set_loop(engine, start, end);
  kb_mixer_seek(engine, start);
  kb_mixer_play(engine);
  Take take;
  const auto pass =
      static_cast<int64_t>(static_cast<double>(end - start) / kSlow);
  count_in::RenderUntil(engine, &take, kLoopPasses * pass);
  kb_engine_destroy(engine);
  std::string levels;
  for (int64_t click : click_take::DetectClicks(take.right)) {
    levels += grid_levels::LevelAt(take.right, click + 1);
  }
  return levels;
}

void ExpectLoop(
    const std::string& stem,
    std::span<const int32_t> groups,
    int32_t rate,
    const std::string& pass,
    const std::string& label
) {
  std::string want;
  for (int i = 0; i < kLoopPasses; ++i) want += pass;
  ExpectLevels(LoopLevels(stem, groups, rate), want, label);
}

std::string
CountedLevels(const std::string& stem, int32_t rate, size_t beat_count) {
  kb_engine* engine = count_in::OpenEngine(stem, kSlow);
  if (engine == nullptr) return "";
  SetGridClick(engine, kTwoOne, rate);
  Take take;
  RenderPaced(engine, &take, count_in::kSettleBlocks);
  const count_in::Start start = count_in::PlanStart(engine, kSlow);
  count_in::CountIn(engine, start, count_in::kClickOn);
  const std::vector<double> beats = Beats();
  std::vector<int64_t> frames;
  for (size_t i = kStartBeat; i < kStartBeat + beat_count; ++i) {
    frames.push_back(GridClick(start.end, start.head, kSlow, beats[i]) + 1);
    if (rate == KB_GRID_RATE_DOUBLE && i + 1 < kStartBeat + beat_count) {
      frames.push_back(
          GridClick(
              start.end,
              start.head,
              kSlow,
              (beats[i] + beats[i + 1]) / 2.0
          ) +
          1
      );
    }
  }
  count_in::RenderUntil(engine, &take, frames.back() + kRingFrames);
  kb_engine_destroy(engine);
  return grid_levels::Levels(take.right, frames);
}

void ExpectCounted(
    const std::string& stem,
    int32_t rate,
    size_t beat_count,
    const std::string& want,
    const std::string& label
) {
  ExpectLevels(CountedLevels(stem, rate, beat_count), want, label);
}

}  // namespace

void RunGroupingTests(const std::string& stem) {
  TestSeekAtSlowSpeed(stem);
  ExpectLoop(
      stem,
      kTwoTwoThree,
      KB_GRID_RATE_HALF,
      "BGGn",
      "grid grouping: x1/2 restarts on the downbeat across a loop wrap"
  );
  ExpectLoop(
      stem,
      kThreeTwoTwo,
      KB_GRID_RATE_DOUBLE,
      "BnnnnnGnnnGnn",
      "grid grouping: x2 halves stop at a loop wrap"
  );
  ExpectCounted(
      stem,
      KB_GRID_RATE_DOUBLE,
      5,
      "BnnnGnBnn",
      "grid grouping: x2 and 2+1 after a counted start"
  );
  ExpectCounted(
      stem,
      KB_GRID_RATE_HALF,
      6,
      "B-GB-G",
      "grid grouping: x1/2 on odd bars after a counted start"
  );
}

}  // namespace stem_sync
