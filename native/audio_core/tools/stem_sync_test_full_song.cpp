#include <algorithm>
#include <cmath>
#include <cstdio>
#include <filesystem>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "mixer/key_bus.h"
#include "mixer/transport_plan.h"
#include "stem_pulse.h"
#include "stem_sync_rate.h"
#include "stretch/time_stretch.h"
#include "time_units.h"

namespace stem_sync {
namespace {

using kitbag::kSecondsPerMinute;
using kitbag_test::Check;

// A beat is a whole multiple of neither the block nor the record spacing, so
// no beat repeats a block phase.
constexpr double kBpm = 117.3;
constexpr double kBeatFrames = kSecondsPerMinute / kBpm * kSampleRate;
constexpr double kFirstBeat = 7001.7;
constexpr int kSongBeats = 300;
constexpr double kSongTailFrames = kSampleRate;
constexpr double kStopIntoTailFrames = kSongTailFrames / 2;
// Onset and engine both take the first whole frame at or after a beat.
constexpr double kMaxUnityErrorFrames = 0.0;
constexpr double kMaxExtraFrames = 1.0;
constexpr double kFullSongRates[] = {0.75, 0.5};
constexpr size_t kNameChars = 32;
constexpr const char* kOnBeat =
    "each click on the first frame at or after its beat";
constexpr const char* kNearUnity =
    "each click within a frame of 1.0x's placement";
constexpr double kLoopFromRate = 0.75;
constexpr double kLoopToRate = 0.5;
constexpr double kLoopStartBeat = 20.37;
constexpr double kLoopEndBeat = 26.61;
constexpr double kLoopSetBeat = 22.5;
constexpr double kChangeAfterPasses = 2.4;
constexpr double kEndAfterPasses = 4.9;

struct Segment {
  double out_first = 0.0;
  double stream_first = 0.0;
  double rate = kitbag::kUnityRate;
};

struct Loop {
  bool on = false;
  double start = 0.0;
  double end = 0.0;
};

struct Script {
  std::vector<Segment> segments;
  Loop loop;
  int64_t loop_block = -1;
  int64_t change_block = -1;
  double change_to = kitbag::kUnityRate;
  int64_t blocks = 0;
};

struct Measure {
  size_t clicks = 0;
  size_t beats = 0;
  double worst = 0.0;
};

std::vector<double> SongBeats() {
  std::vector<double> beats;
  for (int n = 0; n < kSongBeats; ++n) {
    beats.push_back(kFirstBeat + n * kBeatFrames);
  }
  return beats;
}

double SongEnd() {
  return kFirstBeat + (kSongBeats - 1) * kBeatFrames + kSongTailFrames;
}

double LoopLength(const Loop& loop) {
  return loop.end - loop.start;
}

const Segment& SegmentAt(
    const std::vector<Segment>& segments,
    double Segment::* first,
    double at
) {
  const Segment* in = &segments.front();
  for (const Segment& s : segments) {
    if (s.*first <= at) in = &s;
  }
  return *in;
}

double StreamAt(const std::vector<Segment>& segments, double out) {
  const Segment& in = SegmentAt(segments, &Segment::out_first, out);
  return in.stream_first + in.rate * (out - in.out_first);
}

double OutAt(const std::vector<Segment>& segments, double stream) {
  const Segment& in = SegmentAt(segments, &Segment::stream_first, stream);
  return in.out_first + (stream - in.stream_first) / in.rate;
}

// Stream frames run on past the loop end; each pass replays [start, end).
std::vector<double> BeatStreamFrames(const Loop& loop, double stream_end) {
  std::vector<double> frames;
  for (double beat : SongBeats()) {
    if ((!loop.on || beat < loop.end) && beat <= stream_end) {
      frames.push_back(beat);
    }
  }
  if (!loop.on) return frames;
  for (double pass = loop.end; pass < stream_end; pass += LoopLength(loop)) {
    for (double beat : SongBeats()) {
      const double at = pass + beat - loop.start;
      if (beat >= loop.start && beat < loop.end && at <= stream_end) {
        frames.push_back(at);
      }
    }
  }
  std::sort(frames.begin(), frames.end());
  return frames;
}

std::vector<double> ExpectedOutFrames(const Script& script) {
  const auto out_end = static_cast<double>(script.blocks * kBlock);
  std::vector<double> want;
  for (double stream : BeatStreamFrames(
           script.loop,
           StreamAt(script.segments, out_end - 1.0)
       )) {
    want.push_back(OutAt(script.segments, stream));
  }
  return want;
}

void ApplyScriptAt(kb_engine* engine, const Script& script, int64_t block) {
  if (block == script.loop_block) {
    Check(
        kb_mixer_set_loop(
            engine,
            static_cast<int64_t>(script.loop.start),
            static_cast<int64_t>(script.loop.end)
        ) == KB_OK,
        "full song: the loop sets mid-play"
    );
  }
  if (block == script.change_block) {
    Check(
        kb_mixer_set_rate(engine, static_cast<float>(script.change_to)) ==
            KB_OK,
        "full song: the rate changes mid-loop"
    );
  }
}

// Unpaced: a starved stem plays silence, and the clicks follow the song clock.
std::vector<int64_t> PlayScript(kb_engine* engine, const Script& script) {
  click_take::ClickStream clicks;
  std::vector<float> out(static_cast<size_t>(kBlock) * kStereo);
  kb_mixer_set_rate(engine, static_cast<float>(script.segments[0].rate));
  kb_mixer_play(engine);
  for (int64_t b = 0; b < script.blocks; ++b) {
    ApplyScriptAt(engine, script, b);
    kb_engine_render(engine, out.data(), kBlock);
    for (uint32_t f = 0; f < kBlock; ++f) clicks.Feed(out[kStereo * f + 1]);
  }
  return clicks.clicks();
}

Measure Compare(const std::vector<int64_t>& got, const Script& script) {
  const std::vector<double> want = ExpectedOutFrames(script);
  Measure measure{.clicks = got.size(), .beats = want.size()};
  for (size_t k = 0; k < got.size() && k < want.size(); ++k) {
    const double error = static_cast<double>(got[k]) - std::ceil(want[k]);
    measure.worst = std::max(measure.worst, std::fabs(error));
  }
  return measure;
}

Measure RunScript(const std::string& stem, const Script& script) {
  std::vector<double> seconds;
  for (double beat : SongBeats()) seconds.push_back(beat / kSampleRate);
  kb_engine* engine = media_test::OpenFollowingEngine(stem, seconds);
  if (engine == nullptr) return {};
  const std::vector<int64_t> got = PlayScript(engine, script);
  kb_engine_destroy(engine);
  return Compare(got, script);
}

int64_t BlocksFor(double out_frames) {
  return static_cast<int64_t>(out_frames) / kBlock;
}

Script FullSong(double rate) {
  return {
      .segments = {{.rate = rate}},
      .blocks = BlocksFor((SongEnd() - kStopIntoTailFrames) / rate)
  };
}

double OutputLatencyFrames() {
  kitbag::TimeStretch stretch;
  stretch.Configure(kitbag::KeyBus::kChannels, kSampleRate);
  return stretch.OutputLatencyFrames();
}

// A rate change reaches the ear one output latency after its block, so the
// song keeps the old rate until then.
Script LoopWithChange(double from, double to) {
  Script script{.segments = {{.rate = from}}};
  script.loop = {
      .on = true,
      .start = std::floor(kFirstBeat + kLoopStartBeat * kBeatFrames),
      .end = std::floor(kFirstBeat + kLoopEndBeat * kBeatFrames)
  };
  const double pass = LoopLength(script.loop);
  script.loop_block =
      BlocksFor((kFirstBeat + kLoopSetBeat * kBeatFrames) / from);
  const double end_stream = script.loop.end + kEndAfterPasses * pass;
  script.blocks = BlocksFor(end_stream / from);
  if (to == from) return script;
  script.change_block =
      BlocksFor((script.loop.end + kChangeAfterPasses * pass) / from);
  script.change_to = to;
  const double heard =
      static_cast<double>(script.change_block * kBlock) + OutputLatencyFrames();
  script.segments.push_back(
      {.out_first = heard, .stream_first = from * heard, .rate = to}
  );
  script.blocks = BlocksFor(OutAt(script.segments, end_stream));
  return script;
}

void Report(const std::string& name, const Measure& measure, double limit) {
  std::printf(
      "stem_sync_verify: %s: %zu clicks for %zu beats, worst %.3f frames "
      "(limit %.3f)\n",
      name.c_str(),
      measure.clicks,
      measure.beats,
      measure.worst,
      limit
  );
}

void CheckWithin(
    const std::string& name,
    const Measure& measure,
    double limit,
    const char* label
) {
  Report(name, measure, limit);
  Check(
      measure.beats > 0 && measure.clicks == measure.beats,
      (name + ": every beat clicks once").c_str()
  );
  Check(measure.worst <= limit, (name + ": " + label).c_str());
}

std::string FullSongName(double rate) {
  char name[kNameChars];
  std::snprintf(name, sizeof(name), "full song %.2fx", rate);
  return name;
}

void TestFullSong(const std::string& stem) {
  const Measure unity = RunScript(stem, FullSong(kitbag::kUnityRate));
  CheckWithin("full song 1.0x", unity, kMaxUnityErrorFrames, kOnBeat);
  Check(unity.beats == kSongBeats, "full song 1.0x: the run spans every beat");
  for (double rate : kFullSongRates) {
    CheckWithin(
        FullSongName(rate),
        RunScript(stem, FullSong(rate)),
        unity.worst + kMaxExtraFrames,
        kNearUnity
    );
  }
}

void TestLoopAndRateChange(const std::string& stem) {
  const Measure unity =
      RunScript(stem, LoopWithChange(kitbag::kUnityRate, kitbag::kUnityRate));
  CheckWithin("loop 1.0x", unity, kMaxUnityErrorFrames, kOnBeat);
  CheckWithin(
      "loop 0.75x to 0.5x",
      RunScript(stem, LoopWithChange(kLoopFromRate, kLoopToRate)),
      unity.worst + kMaxExtraFrames,
      kNearUnity
  );
}

}  // namespace

void RunFullSongTests() {
  const std::string path = media_test::UniqueTempPath("kitbag_stem_full_song");
  const bool written = media_test::WritePulseStemWav(
      path,
      SongBeats(),
      static_cast<int64_t>(SongEnd()),
      kSampleRate
  );
  Check(written, "fixture: the full-song stem writes");
  if (!written) return;
  TestFullSong(path);
  TestLoopAndRateChange(path);
  std::filesystem::remove(path);
}

}  // namespace stem_sync
