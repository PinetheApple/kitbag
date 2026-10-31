#include "metronome_test_poly_model.h"

namespace metronome_test {
namespace {

constexpr PolySetup kFiveThree{5, 3, 4, 4, 97.0};
constexpr int kCountInBars = 1;
constexpr double kAnchorSongSeconds = 1.3;
constexpr double kLatencyMs = 37.0;
constexpr double kChangedBpm = 131.0;
constexpr int64_t kStartFrame = 12345;
constexpr int kChangedAgainst = 2;

int64_t RunTotal() {
  return FramesFor(kRunSeconds);
}

PolySpan ShiftedSpan(double start_seconds) {
  PolySpan span = FirstSpan(kFiveThree);
  span.start_seconds = start_seconds;
  return span;
}

void TestCountIn() {
  kitbag::Metronome metronome;
  ConfigurePolyOnly(metronome, kFiveThree);
  metronome.SetCountIn(kCountInBars, false, 0);
  metronome.Start();
  const double count_in_seconds =
      kCountInBars * kFiveThree.numerator *
      SecondsPerBeat(kFiveThree.bpm, kFiveThree.denominator);
  const int64_t first_downbeat = FramesFor(count_in_seconds);
  ExpectPolyTicks(
      PolyLabel("after a one-bar count-in", kFiveThree),
      ModelPolyTicks(
          {ShiftedSpan(count_in_seconds)},
          kFiveThree.poly,
          RunTotal()
      ),
      RenderLeft(metronome, RunTotal()),
      first_downbeat - kFrameSlack
  );
}

void TestAnchorExternal() {
  kitbag::Metronome metronome;
  ConfigurePolyOnly(metronome, kFiveThree);
  metronome.AnchorExternal(kAnchorSongSeconds, 0, kFiveThree.bpm);
  ExpectPolyTicks(
      PolyLabel("anchored 1.3 s into a song", kFiveThree),
      ModelPolyTicks(
          {ShiftedSpan(-kAnchorSongSeconds)},
          kFiveThree.poly,
          RunTotal()
      ),
      RenderLeft(metronome, RunTotal())
  );
}

void TestStartAt() {
  kitbag::Metronome metronome;
  ConfigurePolyOnly(metronome, kFiveThree);
  metronome.StartAt(kStartFrame);
  const double start_seconds = static_cast<double>(kStartFrame) / kSampleRate;
  ExpectPolyTicks(
      PolyLabel("started at frame 12345", kFiveThree),
      ModelPolyTicks({ShiftedSpan(start_seconds)}, kFiveThree.poly, RunTotal()),
      RenderLeft(metronome, RunTotal())
  );
}

// The offset moves the whole beat clock earlier, so the poly row must read the
// latency-shifted position and keep it through a tempo change.
void TestLatencyOffsetWithTempoChange() {
  kitbag::Metronome metronome;
  ConfigurePolyOnly(metronome, kFiveThree);
  metronome.SetLatencyOffset(kLatencyMs);
  metronome.Start();
  const std::vector<float> left =
      RenderLeft(metronome, RunTotal(), [&](int64_t at) {
        if (at == kChangeFrame) metronome.SetTempo(kChangedBpm);
      });
  const PolySpan first = FirstSpan(kFiveThree);
  const PolySpan after = SpanFrom(
      first,
      kChangeFrame,
      SecondsPerBeat(kChangedBpm, kFiveThree.denominator),
      first.against
  );
  ExpectPolyTicks(
      PolyLabel("37 ms latency, tempo change to 131:", kFiveThree),
      ModelPolyTicks({first, after}, kFiveThree.poly, RunTotal()),
      left
  );
}

void TestAgainstChangeMidRun() {
  kitbag::Metronome metronome;
  StartPolyOnly(metronome, kFiveThree);
  const std::vector<float> left =
      RenderLeft(metronome, RunTotal(), [&](int64_t at) {
        if (at == kChangeFrame) metronome.SetPolyAgainst(kChangedAgainst);
      });
  const PolySpan first = FirstSpan(kFiveThree);
  const PolySpan after =
      SpanFrom(first, kChangeFrame, first.seconds_per_beat, kChangedAgainst);
  ExpectPolyTicks(
      PolyLabel("against 3 -> 2 mid-run:", kFiveThree),
      ModelPolyTicks({first, after}, kFiveThree.poly, RunTotal()),
      left
  );
}

}  // namespace

void RunPolyTransportTests() {
  TestCountIn();
  TestAnchorExternal();
  TestStartAt();
  TestLatencyOffsetWithTempoChange();
  TestAgainstChangeMidRun();
}

}  // namespace metronome_test
