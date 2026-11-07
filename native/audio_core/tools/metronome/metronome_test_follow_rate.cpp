#include <utility>

#include "click_take.h"
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using click_take::kGapFrames;
using click_take::kSilence;
using Frames = std::vector<int64_t>;

constexpr int64_t kInLatency = 3203;
constexpr int64_t kOutLatency = 3389;
constexpr int64_t kHead = 1777;
// One voice at most an accent; a stacked pair sums to well over this.
constexpr double kPeakTolerance = 1.05;
constexpr int64_t kRingDownFrames = 20 * kBlockFrames;
constexpr double kBpmTolerance = 1e-6;
constexpr double kHalfSpeed = 0.5;
// 20002 / 0.75 ends half a frame into the wrapped pass.
constexpr double kWrapLandsInFrame = 0.5;
constexpr double kThreeQuarters = 0.75;
// A float no power of two scales to a whole number, as a slider's value is.
constexpr double kInexact = static_cast<double>(0.9f);
// A fractional beat fires up to 1/rate frames late off a floored song frame;
// a whole one re-fires if a repeated song frame reads as a jump.
constexpr double kBeats[] = {8011.4, 13780.0, 19001.6, 25500.1, 30777.9};

constexpr int64_t kAnchorOut = 63 * kBlockFrames;
constexpr double kAnchorSong = kHead + kThreeQuarters * kAnchorOut;
constexpr double kAnchoredBeats[] = {8011.4, kAnchorSong, 19001.6, 25500.1};

constexpr int64_t kLoopStart = 24000;
constexpr int64_t kLoopEnd = 60002;
constexpr int64_t kLoopHead = 40000;
constexpr double kLoopBeats[] = {kLoopStart, 36000.4, 48000.7, kLoopEnd - 0.3};

struct Take {
  Frames triggers;
  double peak = 0.0;
};

kitbag::SongRecord RecordFrom(int64_t out, double song, double rate) {
  return {
      .out_first = out - kOutLatency,
      .fed_first = song + kInLatency,
      .rate = rate,
      .layout = {}
  };
}

struct Fixture {
  kitbag::Metronome metronome;
  kitbag::SongRecords records;
  kitbag::LoopLayout layout;
  std::vector<float> buffer = std::vector<float>(kBlockFrames * kChannels);
  int64_t done = 0;
  int64_t quiet = kGapFrames;
  bool playing = true;
  bool opens_on_jump = false;
  Take take;

  template <size_t N>
  explicit Fixture(const double (&beats)[N]) {
    metronome.SetTimeSignature(4, 4);
    auto grid = std::make_unique<kitbag::BeatGrid>();
    for (double beat : beats) {
      grid->beat_times_sec.push_back(beat / kSampleRate);
    }
    metronome.SetGrid(std::move(grid), 0, true);
    metronome.SetFollowMixer(true);
    metronome.Start();
    records.Reserve(8);
  }
  void Reset(const kitbag::SongRecord& record) {
    records.Reset(record, kInLatency, kOutLatency);
  }
  void Note(float sample) {
    const float level = std::fabs(sample);
    take.peak = std::max(take.peak, static_cast<double>(level));
    if (level <= kSilence) {
      ++quiet;
      return;
    }
    if (quiet >= kGapFrames) take.triggers.push_back(done - 1);
    quiet = 0;
  }
  void RenderUntil(int64_t end) {
    while (done + kBlockFrames <= end) {
      std::fill(buffer.begin(), buffer.end(), 0.0f);
      const kitbag::SongClock clock = {
          .playing = playing,
          .opens_on_jump = std::exchange(opens_on_jump, false),
          .first = done,
          .frames = kBlockFrames,
          .records = &records
      };
      metronome.Render(
          buffer.data(),
          kBlockFrames,
          kSampleRate,
          kChannels,
          0,
          &clock
      );
      for (uint32_t f = 0; f < kBlockFrames; ++f, ++done) {
        Note(buffer[f * kChannels]);
      }
    }
  }
};

int64_t LandsOn(int64_t out, double song, double beat, double rate) {
  return out + static_cast<int64_t>(std::ceil((beat - song) / rate));
}

double OneClickPeak() {
  const double beats[] = {kBeats[0]};
  Fixture fixture(beats);
  fixture.Reset(RecordFrom(0, kHead, 1.0));
  fixture.RenderUntil(LandsOn(0, kHead, kBeats[0], 1.0) + kGapFrames);
  return fixture.take.peak;
}

void ExpectSingleVoices(const Take& take, const char* label) {
  const double limit = kPeakTolerance * OneClickPeak();
  Check(take.peak <= limit, label);
  if (take.peak > limit) {
    std::fprintf(stderr, "  peak %.3f, one click %.3f\n", take.peak, limit);
  }
}

void TestBeatsLandOnTheStretchedFrame(double rate, const char* frames) {
  Fixture fixture(kBeats);
  fixture.Reset(RecordFrom(0, kHead, rate));
  Frames want;
  for (double beat : kBeats) want.push_back(LandsOn(0, kHead, beat, rate));
  fixture.RenderUntil(want.back() + kGapFrames);
  Check(click_take::SameClicks(fixture.take.triggers, want), frames);
  ExpectSingleVoices(fixture.take, "follow rate: a beat sounds one voice");
}

void TestRateChangeReanchorsAtOneFrame() {
  Fixture fixture(kAnchoredBeats);
  fixture.Reset(RecordFrom(0, kHead, kThreeQuarters));
  fixture.RenderUntil(kAnchorOut);
  const int64_t change = fixture.done;
  const double song = kHead + kThreeQuarters * static_cast<double>(change);
  fixture.records.Push(RecordFrom(change, song, kHalfSpeed));
  const Frames want = {
      LandsOn(0, kHead, kAnchoredBeats[0], kThreeQuarters),
      LandsOn(0, kHead, kAnchoredBeats[1], kThreeQuarters),
      LandsOn(change, song, kAnchoredBeats[2], kHalfSpeed),
      LandsOn(change, song, kAnchoredBeats[3], kHalfSpeed)
  };
  fixture.RenderUntil(want.back() + kGapFrames);
  Check(
      click_take::SameClicks(fixture.take.triggers, want),
      "follow rate: a change re-anchors with no jumped or doubled beat"
  );
  ExpectSingleVoices(fixture.take, "follow rate: the change stacks no voices");
}

void TestChangeBesideABeatFiresItOnce() {
  const double beats[] = {kAnchorSong + 0.1, 25500.1};
  const int64_t change = kAnchorOut;
  const double song = kAnchorSong;
  Fixture fixture(beats);
  fixture.Reset(RecordFrom(0, kHead, kThreeQuarters));
  fixture.RenderUntil(change);
  fixture.records.Push(RecordFrom(change, song, kHalfSpeed));
  const int64_t last = LandsOn(change, song, beats[1], kHalfSpeed);
  fixture.RenderUntil(last + kGapFrames);
  Check(
      fixture.take.triggers.size() == 2,
      "follow rate: a beat beside the change fires once"
  );
}

void TestLoopWrapKeepsTheStartBeat() {
  Fixture fixture(kLoopBeats);
  kitbag::SongRecord record = RecordFrom(0, kLoopHead, kThreeQuarters);
  record.layout = {.looping = true, .start = kLoopStart, .end = kLoopEnd};
  fixture.Reset(record);
  const auto span = static_cast<double>(kLoopEnd - kLoopHead);
  const int64_t wrap = static_cast<int64_t>(std::ceil(span / kThreeQuarters));
  const Frames want = {
      LandsOn(0, kLoopHead, kLoopBeats[2], kThreeQuarters),
      wrap,
      LandsOn(
          wrap,
          kLoopStart + kWrapLandsInFrame,
          kLoopBeats[1],
          kThreeQuarters
      ),
      LandsOn(
          wrap,
          kLoopStart + kWrapLandsInFrame,
          kLoopBeats[2],
          kThreeQuarters
      )
  };
  fixture.RenderUntil(want.back() + kGapFrames);
  Check(
      click_take::SameClicks(fixture.take.triggers, want),
      "follow rate: a loop wrap sounds the start beat, not the end's"
  );
  ExpectSingleVoices(fixture.take, "follow rate: the wrap stacks no voices");
}

void TestSeekBackReplaysAtRate() {
  Fixture fixture(kBeats);
  fixture.Reset(RecordFrom(0, kHead, kHalfSpeed));
  const int64_t first = LandsOn(0, kHead, kBeats[0], kHalfSpeed);
  fixture.RenderUntil(first + kGapFrames + kBlockFrames);
  const int64_t seek = fixture.done;
  fixture.Reset(RecordFrom(seek, kHead, kHalfSpeed));
  const int64_t again = LandsOn(seek, kHead, kBeats[0], kHalfSpeed);
  fixture.RenderUntil(again + kGapFrames);
  Check(
      click_take::SameClicks(fixture.take.triggers, {first, again}),
      "follow rate: a seek back replays its beat at the same rate"
  );
}

void TestSeekOntoTheLastFrameReplays() {
  const int64_t pause_at = 49 * kBlockFrames;
  const double beats[] = {
      kHead + kHalfSpeed * static_cast<double>(pause_at - 2)
  };
  Fixture fixture(beats);
  fixture.Reset(RecordFrom(0, kHead, kHalfSpeed));
  fixture.RenderUntil(pause_at);
  fixture.playing = false;
  fixture.RenderUntil(pause_at + kRingDownFrames);
  fixture.Reset(RecordFrom(fixture.done, beats[0], kHalfSpeed));
  fixture.playing = true;
  fixture.opens_on_jump = true;
  const int64_t landing = fixture.done;
  fixture.RenderUntil(landing + kGapFrames);
  Check(
      click_take::SameClicks(fixture.take.triggers, {pause_at - 2, landing}),
      "follow rate: a seek onto the frame last heard replays its beat"
  );
  ExpectSingleVoices(
      fixture.take,
      "follow rate: a landing fires its beat once"
  );
}

void TestBpmMirrorStaysSongTempo() {
  const double beats[] = {12000.7, 36001.4, 60002.1};
  Fixture fixture(beats);
  fixture.Reset(RecordFrom(0, 0.0, kHalfSpeed));
  fixture.RenderUntil(LandsOn(0, 0.0, beats[1], kHalfSpeed) + kBlockFrames);
  const double want = 60.0 * kSampleRate / (beats[1] - beats[0]);
  const double got = fixture.metronome.current_bpm();
  Check(
      std::fabs(got - want) < kBpmTolerance,
      "follow rate: current_bpm reads the song's tempo at 0.5x"
  );
}

}  // namespace

void RunFollowRateTests() {
  TestBeatsLandOnTheStretchedFrame(
      kHalfSpeed,
      "follow rate: 0.5x lands each beat on F + (t - P) * sr / rate"
  );
  TestBeatsLandOnTheStretchedFrame(
      kThreeQuarters,
      "follow rate: 0.75x lands each beat on F + (t - P) * sr / rate"
  );
  TestBeatsLandOnTheStretchedFrame(
      kInexact,
      "follow rate: 0.9x lands each beat on F + (t - P) * sr / rate"
  );
  TestRateChangeReanchorsAtOneFrame();
  TestChangeBesideABeatFiresItOnce();
  TestLoopWrapKeepsTheStartBeat();
  TestSeekBackReplaysAtRate();
  TestSeekOntoTheLastFrameReplays();
  TestBpmMirrorStaysSongTempo();
}

}  // namespace metronome_test
