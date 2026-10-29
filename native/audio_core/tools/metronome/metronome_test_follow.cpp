#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr int64_t kLoopStart = 24000;
constexpr int64_t kLoopEnd = 60001;
constexpr int64_t kPlayFrom = 40000;
constexpr int64_t kNormalBeat = 48000;
constexpr int64_t kNormalAt = kNormalBeat - kPlayFrom;
constexpr int64_t kWrapAt = kLoopEnd - kPlayFrom;
constexpr int64_t kClickFrames = 4096;
constexpr int64_t kRenderFrames = kWrapAt + kClickFrames + kBlockFrames;
// Under kGridEpsilon past end - 1, so the epsilon alone would fire it there.
constexpr double kEpsilonEdge = kLoopEnd - 1 + 3e-5;
constexpr double kFractionalEdge = kLoopEnd - 0.3;
constexpr double kFractionalLatencyMs = 20.3;
// One voice at most an accent; a stacked pair sums to well over this.
constexpr double kPeakTolerance = 1.05;

struct WrapTake {
  double single = 0.0;
  double wrap = 0.0;
  int64_t first_sound = -1;
};

kitbag::SongClock Clock(int64_t first) {
  return {
      .playing = true,
      .first = first,
      .frames = kBlockFrames,
      .layout = {
          .looping = true,
          .start = kLoopStart,
          .end = kLoopEnd,
          .crossfade = 0
      }
  };
}

void Note(WrapTake* take, int64_t at, float sample) {
  const double level = std::fabs(static_cast<double>(sample));
  if (take->first_sound < 0 && level > 0.0) take->first_sound = at;
  if (at >= kNormalAt && at < kNormalAt + kClickFrames) {
    take->single = std::max(take->single, level);
  }
  if (at >= kWrapAt - kBlockFrames) take->wrap = std::max(take->wrap, level);
}

// The loop-end beat is an accent and the loop start a plain beat, so a fired
// edge beat stacks under the wrap's click.
WrapTake RenderWrap(double edge_frame, double latency_ms) {
  kitbag::Metronome metronome;
  metronome.SetTimeSignature(4, 4);
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (double frame : {12000.0, 24000.0, 36000.0, 48000.0, edge_frame}) {
    grid->beat_times_sec.push_back(frame / kSampleRate);
  }
  metronome.SetGrid(std::move(grid), 0, true);
  metronome.SetLatencyOffset(latency_ms);
  metronome.SetFollowMixer(true);
  metronome.Start();
  std::vector<float> buffer(kBlockFrames * kChannels);
  WrapTake take;
  for (int64_t done = 0; done < kRenderFrames; done += kBlockFrames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    const kitbag::SongClock clock = Clock(kPlayFrom + done);
    metronome
        .Render(buffer.data(), kBlockFrames, kSampleRate, kChannels, 0, &clock);
    for (uint32_t f = 0; f < kBlockFrames; ++f) {
      Note(&take, done + f, buffer[f * kChannels]);
    }
  }
  return take;
}

void ExpectOneClickAtTheWrap(const WrapTake& take, const char* label) {
  const bool sounded = take.wrap > take.single / 2;
  Check(sounded && take.wrap <= kPeakTolerance * take.single, label);
  if (!sounded || take.wrap > kPeakTolerance * take.single) {
    std::fprintf(
        stderr,
        "  wrap peak %.3f, one click %.3f\n",
        take.wrap,
        take.single
    );
  }
}

void TestBeatWithinEpsilonOfTheEndWaits() {
  ExpectOneClickAtTheWrap(
      RenderWrap(kEpsilonEdge, 0.0),
      "follow: a beat past end - 1 waits for the wrap"
  );
}

void TestLatencyOffsetIsIgnored() {
  const WrapTake take = RenderWrap(kFractionalEdge, kFractionalLatencyMs);
  ExpectOneClickAtTheWrap(take, "follow: a fractional offset stacks nothing");
  Check(
      take.first_sound == kNormalAt + 1,
      "follow: the offset leaves the click on its song frame"
  );
}

}  // namespace

void RunFollowTests() {
  TestBeatWithinEpsilonOfTheEndWaits();
  TestLatencyOffsetIsIgnored();
}

}  // namespace metronome_test
