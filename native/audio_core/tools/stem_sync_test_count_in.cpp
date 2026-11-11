#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <limits>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "downbeats.h"
#include "metronome/metronome.h"
#include "metronome/metronome_internal.h"
#include "mixer/transport_plan.h"
#include "stem_sync_rate.h"
#include "wav_fixture.h"

namespace stem_sync {
namespace {

using click_take::DetectClicks;
using click_take::SameClicks;
using kitbag_test::Check;

constexpr int32_t kBarBeats = 3;
constexpr int32_t kFirstDownbeat = 1;
constexpr int32_t kCountInBars = 2;
constexpr int32_t kWoodblock = 1;
constexpr int kCountBeats = kCountInBars * kBarBeats;
// A downbeat 0.9 frames past a whole frame: the head snaps back onto the whole
// frame, so the bar's first click sounds after the end frame, not on it.
constexpr size_t kStartBeat = 7;
constexpr size_t kGridClicks = 3;
constexpr size_t kResumeClicks = 2;
// The end frame's index in its block: a start applied at the block's first
// frame comes this early.
constexpr int64_t kEndLead = 211;
constexpr int64_t kSafetyFrames = 4800;
constexpr int kSettleBlocks = 30;
constexpr int kPauseBlocks = 10;
constexpr int64_t kResumeSeek = 300007;
constexpr size_t kCancelAfter = 3;
constexpr double kHalfFrame = 0.5;
constexpr double kFireSlackFrames =
    kitbag::metronome_detail::kGridEpsilon * kSampleRate;
constexpr double kRates[] = {0.75, 0.5};
constexpr int64_t kNotFound = -1;

struct Start {
  double rate = kitbag::kUnityRate;
  int64_t head = 0;
  double beat_frames = 0.0;
  int64_t end = 0;
};

struct Run {
  Start start;
  Take take;
  bool queued = false;
  int64_t paused_at = 0;
  int64_t resumed_at = 0;
};

kb_engine* OpenEngine(const std::string& stem, double rate) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  std::vector<double> seconds;
  for (double beat : Beats()) seconds.push_back(beat / kSampleRate);
  const std::vector<int32_t> downbeats =
      kitbag_test::EveryNthBeat(kFirstDownbeat, kBarBeats, kBeatCount);
  if (kb_mixer_load_track(engine, 0, stem.c_str()) != KB_OK ||
      kb_metronome_set_grid(
          engine,
          seconds.data(),
          static_cast<int32_t>(seconds.size()),
          downbeats.data(),
          static_cast<int32_t>(downbeats.size()),
          0
      ) != KB_OK ||
      kb_mixer_set_rate(engine, static_cast<float>(rate)) != KB_OK) {
    kb_engine_destroy(engine);
    return nullptr;
  }
  kb_metronome_set_count_in(engine, kCountInBars, 1, kWoodblock);
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  return engine;
}

// The caller's side of a counted start: the head on the bar's whole frame, the
// count at the beat before it, slowed with the song.
Start PlanStart(kb_engine* engine, double rate) {
  const std::vector<double> beats = Beats();
  Start start{
      .rate = rate,
      .head = static_cast<int64_t>(std::floor(beats[kStartBeat])),
      .beat_frames = (beats[kStartBeat] - beats[kStartBeat - 1]) / rate
  };
  const int64_t earliest =
      static_cast<int64_t>(kb_engine_frames_rendered(engine)) + kSafetyFrames +
      std::llround(kCountBeats * start.beat_frames);
  start.end = earliest + (kEndLead + kBlock - earliest % kBlock) % kBlock;
  return start;
}

bool CountIn(kb_engine* engine, const Start& start) {
  kb_mixer_seek(engine, start.head);
  const auto end = static_cast<uint64_t>(start.end);
  return kb_metronome_count_in_at(engine, end, start.beat_frames, kBarBeats) ==
             KB_OK &&
         kb_mixer_play_at(engine, end) == KB_OK;
}

// A beat sounds on the first output frame whose song position reaches it.
int64_t GridClick(int64_t out, int64_t head, double rate, double beat) {
  const double song_frames =
      beat - static_cast<double>(head) - kFireSlackFrames;
  return out +
         static_cast<int64_t>(std::ceil(std::max(0.0, song_frames) / rate));
}

int64_t Midway(int64_t out, int64_t head, double rate, size_t beat) {
  const std::vector<double> beats = Beats();
  return (GridClick(out, head, rate, beats[beat]) +
          GridClick(out, head, rate, beats[beat + 1])) /
         2;
}

size_t FirstBeatAfter(int64_t head) {
  const std::vector<double> beats = Beats();
  size_t i = 0;
  while (i < beats.size() && beats[i] <= static_cast<double>(head)) ++i;
  return i;
}

// From the song's own beats, not the caller's spacing: the count is heard at
// the slowed song's tempo.
std::vector<int64_t> CountClicks(const Start& start) {
  const std::vector<double> beats = Beats();
  const double heard = (beats[kStartBeat] - beats[kStartBeat - 1]) / start.rate;
  std::vector<int64_t> clicks;
  for (int k = kCountBeats; k >= 1; --k) {
    clicks.push_back(std::llround(start.end - k * heard));
  }
  return clicks;
}

std::vector<int64_t> CountedStartClicks(const Start& start) {
  std::vector<int64_t> clicks = CountClicks(start);
  const std::vector<double> beats = Beats();
  for (size_t i = kStartBeat; i < kStartBeat + kGridClicks; ++i) {
    clicks.push_back(GridClick(start.end, start.head, start.rate, beats[i]));
  }
  return clicks;
}

std::vector<int64_t> ResumeClicks(const Run& run) {
  std::vector<int64_t> clicks;
  const std::vector<double> beats = Beats();
  const size_t first = FirstBeatAfter(kResumeSeek);
  for (size_t i = first; i < first + kResumeClicks; ++i) {
    clicks.push_back(
        GridClick(run.resumed_at, kResumeSeek, run.start.rate, beats[i])
    );
  }
  return clicks;
}

void RenderUntil(kb_engine* engine, Take* take, int64_t frame) {
  while (static_cast<int64_t>(take->right.size()) <= frame) {
    RenderPaced(engine, take, 1);
  }
}

void CountInAndResume(kb_engine* engine, Run* run) {
  RenderPaced(engine, &run->take, kSettleBlocks);
  const Start& s = run->start = PlanStart(engine, run->start.rate);
  run->queued = CountIn(engine, s);
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

int64_t FirstStem(const Take& take) {
  for (size_t k = 0; k < take.left.size(); ++k) {
    if (std::fabs(take.left[k] - take.right[k]) > kHalfFrame) {
      return static_cast<int64_t>(k);
    }
  }
  return kNotFound;
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
  const bool queued = CountIn(engine, start);
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

void TestSongStartAbi() {
  constexpr uint64_t kTooFar =
      (uint64_t{1} << std::numeric_limits<double>::digits) + 1;
  constexpr double kBeat = 12000.0;
  constexpr double kMinBeat = kitbag::CountInSchedule::kMinBeatFrames;
  constexpr int32_t kTooManyBeats = kitbag::Metronome::kMaxBeats + 1;
  kb_engine* engine = nullptr;
  Check(kb_engine_create(&engine) == KB_OK, "song start abi: engine opens");
  if (engine == nullptr) return;
  Check(
      kb_mixer_play_at(nullptr, 0) == KB_ERROR_INVALID_ARGUMENT &&
          kb_metronome_count_in_at(nullptr, 0, kBeat, kBarBeats) ==
              KB_ERROR_INVALID_ARGUMENT,
      "song start abi: a null engine is refused"
  );
  Check(
      kb_metronome_count_in_at(engine, 0, kMinBeat / 2, kBarBeats) != KB_OK &&
          kb_metronome_count_in_at(engine, 0, std::nan(""), kBarBeats) !=
              KB_OK &&
          kb_metronome_count_in_at(engine, 0, kBeat, 0) != KB_OK &&
          kb_metronome_count_in_at(engine, 0, kBeat, kTooManyBeats) != KB_OK &&
          kb_metronome_count_in_at(engine, kTooFar, kBeat, kBarBeats) != KB_OK,
      "song start abi: count_in_at refuses a bad beat, bar or frame"
  );
  Check(
      kb_metronome_count_in_at(engine, kTooFar - 1, kMinBeat, 1) == KB_OK &&
          kb_mixer_play_at(engine, kTooFar - 1) == KB_OK,
      "song start abi: the bounds themselves are accepted"
  );
  kb_engine_destroy(engine);
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
    std::filesystem::remove(ramp);
  }
  for (double rate : kRates) TestPulseStart(pulses, rate);
  TestSongStartAbi();
}

}  // namespace stem_sync
