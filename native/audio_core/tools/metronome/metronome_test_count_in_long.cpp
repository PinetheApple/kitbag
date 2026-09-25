#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

constexpr int kHihat = 4;
constexpr int kLongBars = 4;
constexpr int kLongBeats = 16;
constexpr int64_t kCompareFrames = 48000;

int64_t BeatFrames(double bpm) {
  return static_cast<int64_t>(std::llround(kSampleRate * 60.0 / bpm));
}

std::vector<float>
RenderWindow(kitbag::Metronome& metronome, int64_t from, int64_t count) {
  std::vector<float> window;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  for (int64_t rendered = 0; rendered < from + count;
       rendered += kBlockFrames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(rendered)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      const int64_t at = rendered + frame;
      if (at >= from && at < from + count) {
        window.push_back(buffer[static_cast<size_t>(frame) * kChannels]);
      }
    }
  }
  return window;
}

void Configure(kitbag::Metronome& metronome, double bpm, double latency_ms) {
  metronome.SetTempo(bpm);
  metronome.SetTimeSignature(kLongBeats, 4);
  metronome.SetLatencyOffset(latency_ms);
}

void ExpectBarOneExact(double bpm, double latency_ms, const char* label) {
  const int64_t bar_one = int64_t{kLongBars} * kLongBeats * BeatFrames(bpm);
  kitbag::Metronome counted;
  Configure(counted, bpm, latency_ms);
  counted.SetCountIn(kLongBars, true, kHihat);
  counted.Start();
  kitbag::Metronome plain;
  Configure(plain, bpm, latency_ms);
  plain.StartAt(static_cast<uint64_t>(bar_one));
  const auto a = RenderWindow(counted, bar_one, kCompareFrames);
  const auto b = RenderWindow(plain, bar_one, kCompareFrames);
  Check(SameSamples(a, 0, b, 0, kCompareFrames), label);
}

std::vector<int64_t> CountInWithTempoChange(double latency_ms) {
  const int64_t change = int64_t{100} * kBlockFrames;
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetLatencyOffset(latency_ms);
  metronome.SetCountIn(1, true, kHihat);
  metronome.Start();
  return RenderContinuous(metronome, int64_t{kSampleRate} * 4, [&](int64_t at) {
    if (at == change) metronome.SetTempo(60.0);
  });
}

void TestTempoChangeDuringCountIn() {
  constexpr double kBarOneFrame = 166400.0;
  const auto plain = CountInWithTempoChange(0.0);
  const auto shifted = CountInWithTempoChange(100.0);
  Check(
      plain.size() == 5 &&
          std::fabs(static_cast<double>(plain.back()) - kBarOneFrame) <= 2.0,
      "count-in: a tempo change mid-count rescales the rest; bar one at 166400"
  );
  Check(
      shifted == plain,
      "count-in: under +100 ms the mid-count tempo change keeps the same phase"
  );
}

}  // namespace

void RunLongCountInTests() {
  ExpectBarOneExact(20.0, 0.0, "long count-in: 4 bars 16/4 at 20 BPM, exact");
  ExpectBarOneExact(20.0, 100.0, "long count-in: 20 BPM, +100 ms, exact");
  ExpectBarOneExact(20.0, -100.0, "long count-in: 20 BPM, -100 ms, exact");
  ExpectBarOneExact(400.0, 0.0, "long count-in: 4 bars 16/4 at 400 BPM, exact");
  ExpectBarOneExact(400.0, 100.0, "long count-in: 400 BPM, +100 ms, exact");
  ExpectBarOneExact(400.0, -100.0, "long count-in: 400 BPM, -100 ms, exact");
  TestTempoChangeDuringCountIn();
}

}  // namespace metronome_test
