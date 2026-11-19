#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "metronome/metronome.h"
#include "stem_sync_count_in.h"
#include "wav_fixture.h"

namespace stem_sync {
namespace {

using click_take::DetectClicks;
using click_take::SameClicks;
using count_in::CountClicks;
using count_in::FirstBeatAfter;
using count_in::FirstStem;
using count_in::HeardFrame;
using count_in::kBarBeats;
using count_in::kClickOn;
using count_in::kCountBeats;
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

constexpr size_t kGridClicks = 3;
constexpr size_t kResumeClicks = 2;
constexpr int kPauseBlocks = 10;
constexpr int64_t kResumeSeek = 300007;
constexpr size_t kCancelAfter = 3;
constexpr double kRates[] = {0.75, 0.5};

struct Run {
  Start start;
  Take take;
  bool queued = false;
  int64_t paused_at = 0;
  int64_t resumed_at = 0;
};

bool CountInClickOn(kb_engine* engine, const Start& start) {
  return count_in::CountIn(engine, start, kClickOn);
}

int64_t Midway(int64_t out, int64_t head, double rate, size_t beat) {
  const std::vector<double> beats = Beats();
  return (HeardFrame(out, head, rate, beats[beat]) +
          HeardFrame(out, head, rate, beats[beat + 1])) /
         2;
}

std::vector<int64_t> CountedStartClicks(const Start& start) {
  std::vector<int64_t> clicks = CountClicks(start);
  const std::vector<double> beats = Beats();
  for (size_t i = kStartBeat; i < kStartBeat + kGridClicks; ++i) {
    clicks.push_back(HeardFrame(start.end, start.head, start.rate, beats[i]));
  }
  return clicks;
}

std::vector<int64_t> ResumeClicks(const Run& run) {
  std::vector<int64_t> clicks;
  const std::vector<double> beats = Beats();
  const size_t first = FirstBeatAfter(kResumeSeek);
  for (size_t i = first; i < first + kResumeClicks; ++i) {
    clicks.push_back(
        HeardFrame(run.resumed_at, kResumeSeek, run.start.rate, beats[i])
    );
  }
  return clicks;
}

void CountInAndResume(kb_engine* engine, Run* run) {
  RenderPaced(engine, &run->take, kSettleBlocks);
  const Start& s = run->start = PlanStart(engine, run->start.rate);
  run->queued = CountInClickOn(engine, s);
  const size_t last = kStartBeat + kGridClicks - 1;
  RenderUntil(engine, &run->take, Midway(s.end, s.head, s.rate, last));
  run->paused_at = static_cast<int64_t>(run->take.right.size());
  kb_mixer_pause(engine);
  RenderPaced(engine, &run->take, kPauseBlocks);
  kb_mixer_seek(engine, kResumeSeek);
  run->resumed_at = static_cast<int64_t>(run->take.right.size());
  kb_mixer_play(engine);
  const size_t resumed_last = FirstBeatAfter(kResumeSeek) + kResumeClicks - 1;
  RenderUntil(
      engine,
      &run->take,
      Midway(run->resumed_at, kResumeSeek, s.rate, resumed_last)
  );
}

Run RunCountedStart(const std::string& stem, double rate) {
  Run run;
  run.start.rate = rate;
  kb_engine* engine = OpenEngine(stem, rate);
  if (engine == nullptr) return run;
  CountInAndResume(engine, &run);
  kb_engine_destroy(engine);
  return run;
}

void CheckClicks(const Run& run, const std::string& name) {
  std::vector<int64_t> before;
  std::vector<int64_t> after;
  for (int64_t click : DetectClicks(run.take.right)) {
    (click < run.paused_at ? before : after).push_back(click);
  }
  Check(
      run.queued && SameClicks(before, CountedStartClicks(run.start)),
      (name + ": the count ends on the end frame, the bar clicks on the song")
          .c_str()
  );
  Check(
      SameClicks(after, ResumeClicks(run)),
      (name + ": seek and resume after the count keep the lock").c_str()
  );
}

void TestRampStart(const std::string& ramp) {
  const Run run = RunCountedStart(ramp, kitbag::kUnityRate);
  CheckClicks(run, "count-in 1.0x");
  const int64_t first = FirstStem(run.take);
  Check(
      first == run.start.end,
      "count-in 1.0x: the song starts on the end frame"
  );
  if (first != run.start.end) {
    std::fprintf(
        stderr,
        "  first %lld, end %lld\n",
        (long long)first,
        (long long)run.start.end
    );
  }
  const auto at = static_cast<size_t>(std::max<int64_t>(first, 0));
  const double stem =
      at < run.take.left.size() ? run.take.left[at] - run.take.right[at] : -1.0;
  Check(
      std::fabs(stem - static_cast<double>(run.start.head)) <= kHalfFrame,
      "count-in 1.0x: the end frame plays the bar's head"
  );
}

void TestPulseStart(const std::string& pulses, double rate) {
  const Run run = RunCountedStart(pulses, rate);
  const std::string name =
      "count-in " + std::to_string(rate).substr(0, 4) + "x";
  CheckClicks(run, name);
  const auto centre =
      static_cast<double>(std::llround(Beats()[kStartBeat + 1]));
  const double want =
      run.start.end + (centre - static_cast<double>(run.start.head)) / rate;
  const auto half = static_cast<int64_t>(kSongWindowFrames / rate);
  const double got = PulseCentre(run.take, std::llround(want), half);
  const double off_ms = (got - want) / kSampleRate * kMsPerSecond;
  Check(
      std::fabs(off_ms) <= kMaxLockMs,
      (name + ": stretched, the song sounds from the head on the end frame")
          .c_str()
  );
  if (std::fabs(off_ms) > kMaxLockMs) {
    std::fprintf(stderr, "  off %.3f ms\n", off_ms);
  }
}

void CancelCount(kb_engine* engine, bool stop) {
  if (stop) {
    kb_mixer_stop(engine);
    kb_metronome_stop(engine);
    return;
  }
  kb_mixer_pause(engine);
  kb_metronome_pause(engine);
}

void TestCancelDuringCount(const std::string& ramp, bool stop) {
  kb_engine* engine = OpenEngine(ramp, kitbag::kUnityRate);
  if (engine == nullptr) return;
  Take take;
  RenderPaced(engine, &take, kSettleBlocks);
  const Start start = PlanStart(engine, kitbag::kUnityRate);
  const bool queued = CountInClickOn(engine, start);
  RenderUntil(
      engine,
      &take,
      CountClicks(start)[kCancelAfter - 1] + kSafetyFrames
  );
  CancelCount(engine, stop);
  RenderUntil(engine, &take, start.end + std::llround(2 * start.beat_frames));
  const bool idle =
      kb_mixer_is_playing(engine) == 0 && kb_metronome_is_running(engine) == 0;
  kb_engine_destroy(engine);
  const std::string name = stop ? "count-in stop" : "count-in pause";
  Check(
      queued && idle && FirstStem(take) == kNotFound,
      (name + ": the song never starts").c_str()
  );
  Check(
      DetectClicks(take.right).size() == kCancelAfter,
      (name + ": the count stops with it").c_str()
  );
}

bool RefusesCountIn(kb_engine* engine, uint64_t end, double beat, int32_t bar) {
  return kb_metronome_count_in_at(engine, end, beat, bar, kClickOn) != KB_OK;
}

void TestSongStartAbi() {
  constexpr double kAbiBeat = 12000.0;
  constexpr double kMinBeat = kitbag::CountInSchedule::kMinBeatFrames;
  constexpr uint64_t kTooFar = KB_MAX_EXACT_FRAME + 1;
  constexpr int32_t kTooManyBeats = kitbag::Metronome::kMaxBeats + 1;
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "song start abi: engine opens");
  if (engine == nullptr) return;
  Check(
      kb_mixer_play_at(nullptr, 0) == KB_ERROR_INVALID_ARGUMENT &&
          kb_metronome_count_in_at(nullptr, 0, kAbiBeat, kBarBeats, kClickOn) ==
              KB_ERROR_INVALID_ARGUMENT,
      "song start abi: a null engine is refused"
  );
  Check(
      RefusesCountIn(engine, 0, kMinBeat / 2, kBarBeats) &&
          RefusesCountIn(engine, 0, std::nan(""), kBarBeats) &&
          RefusesCountIn(engine, 0, kAbiBeat, 0) &&
          RefusesCountIn(engine, 0, kAbiBeat, kTooManyBeats) &&
          RefusesCountIn(engine, kTooFar, kAbiBeat, kBarBeats),
      "song start abi: count_in_at refuses a bad beat, bar or frame"
  );
  Check(
      kb_metronome_count_in_at(engine, kTooFar - 1, kMinBeat, 1, kClickOn) ==
              KB_OK &&
          kb_mixer_play_at(engine, kTooFar - 1) == KB_OK,
      "song start abi: the bounds themselves are accepted"
  );
  kb_engine_destroy(engine);
}

void TestFullRingClaimsNoIntent() {
  constexpr double kBeat = 12000.0;
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return;
  const bool idle_before = kb_engine_idle(engine) != 0;
  for (size_t i = 0; i < kitbag::Metronome::kCommandRingSize; ++i) {
    kb_metronome_set_tempo(engine, kitbag::Metronome::kDefaultBpm);
  }
  const kb_result counted =
      kb_metronome_count_in_at(engine, 0, kBeat, kBarBeats, kClickOn);
  const bool idle_after = kb_engine_idle(engine) != 0;
  kb_engine_destroy(engine);
  Check(
      idle_before && counted == KB_ERROR_BUSY && idle_after,
      "song start abi: a full ring refuses the count before claiming intent"
  );
}

}  // namespace

void RunCountInTests(const std::string& pulses) {
  const std::string ramp = media_test::WriteRampWav(
      "kitbag_count_in_ramp",
      static_cast<uint64_t>(SongFrames()),
      kStereo,
      kSampleRate
  );
  Check(!ramp.empty(), "fixture: the count-in ramp writes");
  if (!ramp.empty()) {
    TestRampStart(ramp);
    TestCancelDuringCount(ramp, false);
    TestCancelDuringCount(ramp, true);
    RunSilentCountInTests(ramp);
    std::filesystem::remove(ramp);
  }
  for (double rate : kRates) TestPulseStart(pulses, rate);
  TestSongStartAbi();
  TestFullRingClaimsNoIntent();
}

}  // namespace stem_sync
