#include <cstdio>
#include <vector>

#include "analysis/downbeat.h"
#include "analyze_buffer_driver.h"
#include "analyze_test_support.h"
#include "check.h"

namespace analyze_test {
namespace {

using kitbag_test::Check;

constexpr int kBeatsPerBar = 4;
constexpr int kAccentBeats = 28;
constexpr float kAccentHz = 150.0f;
constexpr float kPlainHz = 250.0f;

// One beat in each bar differs, so the change into it and out of it are equal:
// spectral difference alone cannot say which side of the pair is bar one.
std::vector<float> MakeAccentMono(int phase) {
  const int total = (kAccentBeats + 1) * kBeatPeriodFrames;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  for (int b = 0; b < kAccentBeats; ++b) {
    const bool accent = b % kBeatsPerBar == phase;
    AddToneBeat(pcm, b, accent ? kAccentHz : kPlainHz, kToneAmp);
  }
  std::vector<float> mono(pcm.size() / 2);
  for (size_t f = 0; f < mono.size(); ++f) mono[f] = pcm[f * 2];
  return mono;
}

std::vector<float> ClickGrid() {
  std::vector<float> grid;
  for (int b = 0; b <= kAccentBeats; ++b) {
    grid.push_back(
        static_cast<float>(
            static_cast<double>(b) * kBeatPeriodFrames / kSampleRate
        )
    );
  }
  return grid;
}

void CheckAccentPhase(int phase) {
  const std::vector<float> mono = MakeAccentMono(phase);
  const std::vector<int> db = FindDownbeats(
      mono.data(),
      static_cast<int>(mono.size()),
      static_cast<int>(kSampleRate),
      ClickGrid(),
      kBeatsPerBar
  );
  const int found = db.empty() ? -1 : db[0] % kBeatsPerBar;
  std::printf(
      "analyze_verify: accent on beat index %d -> bar one at %d\n",
      phase,
      found
  );
  Check(found == phase, "accent: bar one lands on the accented beat");
}

}  // namespace

void RunAccentTests() {
  for (int phase = 0; phase < kBeatsPerBar; ++phase) CheckAccentPhase(phase);
}

}  // namespace analyze_test
