// Offline sequencer verification: renders the metronome without a device and
// asserts click onsets land on the beat grid, including across a tempo change.
#include <cmath>
#include <cstdio>
#include <vector>

#include "../src/metronome.h"

namespace {

constexpr uint32_t kSampleRate = 48000;
constexpr uint32_t kChannels = 2;
constexpr uint32_t kBlockFrames = 256;
constexpr double kOnsetThreshold = 0.05;
// A click is one onset; the window must outlast the click's decay tail
// (~4600 frames at the slowest preset) while staying under the smallest
// inter-click gap in these tests (12000 frames).
constexpr int kOnsetHoldFrames = 6000;
constexpr double kMaxJitterFrames = 1.5;

int g_failures = 0;

void Check(bool condition, const char* message) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", message);
    ++g_failures;
  }
}

std::vector<int64_t> RenderAndDetectOnsets(kitbag::Metronome& metronome,
                                           int64_t total_frames) {
  std::vector<int64_t> onsets;
  std::vector<float> buffer(kBlockFrames * kChannels);
  int64_t rendered = 0;
  int64_t last_onset = -kOnsetHoldFrames;
  float previous_abs = 0.0f;

  while (rendered < total_frames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(buffer.data(), kBlockFrames, kSampleRate, kChannels);
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      const float amplitude = std::fabs(buffer[frame * kChannels]);
      const int64_t index = rendered + frame;
      if (amplitude > kOnsetThreshold && previous_abs <= kOnsetThreshold &&
          index - last_onset >= kOnsetHoldFrames) {
        onsets.push_back(index);
        last_onset = index;
      }
      previous_abs = amplitude;
    }
    rendered += kBlockFrames;
  }
  return onsets;
}

void ExpectSpacing(const std::vector<int64_t>& onsets, size_t from, size_t to,
                   double expected_frames, const char* label) {
  for (size_t i = from + 1; i < to && i < onsets.size(); ++i) {
    const double spacing =
        static_cast<double>(onsets[i] - onsets[i - 1]);
    if (std::fabs(spacing - expected_frames) > kMaxJitterFrames) {
      std::fprintf(stderr, "FAIL: %s interval %zu = %.1f, expected %.1f\n",
                   label, i, spacing, expected_frames);
      ++g_failures;
      return;
    }
  }
}

void TestSteadyTempo() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 10);
  // 120 BPM = 2 clicks/s = 20 clicks in 10 s (first at frame 0).
  Check(onsets.size() == 20, "steady: expected 20 clicks in 10s at 120 BPM");
  Check(!onsets.empty() && onsets[0] < kOnsetHoldFrames,
        "steady: first click at t=0");
  ExpectSpacing(onsets, 0, onsets.size(), 60.0 / 120.0 * kSampleRate,
                "steady 120 BPM");
}

void TestTempoChange() {
  kitbag::Metronome metronome;
  metronome.SetTempo(100.0);
  metronome.Start();

  auto first = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  ExpectSpacing(first, 0, first.size(), 60.0 / 100.0 * kSampleRate,
                "pre-change 100 BPM");

  metronome.SetTempo(200.0);
  auto second = RenderAndDetectOnsets(metronome, kSampleRate * 6);
  // Skip the straddling first interval; the rest must be exactly 200 BPM.
  ExpectSpacing(second, 1, second.size(), 60.0 / 200.0 * kSampleRate,
                "post-change 200 BPM");
  Check(second.size() >= 18, "tempo change: clicks keep coming");
}

void TestSubdivisionAndMute() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(2);
  metronome.SetSubdivision(2);
  metronome.SetAccent(1, kitbag::Accent::kMuted);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 4);
  // Bar = 1s: beat0 + its offbeat sound, beat1 muted entirely → 2 clicks/bar.
  Check(onsets.size() == 8, "subdivision+mute: 2 clicks per 1s bar over 4s");
  ExpectSpacing(onsets, 0, 2, 0.25 * kSampleRate, "eighth spacing");
}

void TestPolyrhythm() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.SetPolyrhythm(true, 3);
  metronome.Start();

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 8);
  // Per 2s bar: 4 main + 3 poly, minus coinciding downbeat (one onset) = 6.
  Check(onsets.size() == 24, "3:4 poly: 6 onsets per bar over 4 bars");
}

}  // namespace

int main() {
  TestSteadyTempo();
  TestTempoChange();
  TestSubdivisionAndMute();
  TestPolyrhythm();
  if (g_failures == 0) {
    std::printf("metronome_verify: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "metronome_verify: %d failure(s)\n", g_failures);
  return 1;
}
