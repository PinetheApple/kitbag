#include <cstdio>
#include <vector>

#include "analysis/bar_one.h"
#include "analysis/downbeat.h"
#include "analysis/meter.h"
#include "analyze_buffer_driver.h"
#include "analyze_test_support.h"
#include "check.h"

namespace analyze_test {
namespace {

using kitbag::kCommonBeatsPerBar;
using kitbag::kTripleBeatsPerBar;
using kitbag_test::Check;

constexpr int kAccentBeats = 28;
constexpr float kAccentHz = 150.0f;
constexpr float kPlainHz = 250.0f;
// Joins each bar's chord on beat 4, so the change into beat 4 is partial and
// the change out of it, into the next chord, is whole.
constexpr float kApproachHz = 220.0f;
constexpr int kApproachPosition = kCommonBeatsPerBar - 1;
constexpr size_t kUnitBars = 8;
constexpr size_t kFewBars = 2;
constexpr double kNoiseAmplitude = 0.5;
// About four standard errors of clearance over two bars: past a flat 2.0 gate,
// short of the t value for one degree of freedom.
constexpr double kFewBarsNoise = 0.017;
constexpr double kRoundingGap = 1e-12;

struct Beat {
  float hz;
  float extra_hz;
};

using BeatAt = Beat (*)(int beat, int meter, int phase);

Beat AccentBeat(int beat, int meter, int phase) {
  return {beat % meter == phase ? kAccentHz : kPlainHz, 0.0f};
}

Beat ApproachBeat(int beat, int meter, int /*phase*/) {
  const float chord = kBarPitchesHz[(beat / meter) % kBarPitchesHz.size()];
  return {chord, beat % meter == kApproachPosition ? kApproachHz : 0.0f};
}

std::vector<float> MakeMono(BeatAt beat_at, int meter, int phase) {
  const int total = (kAccentBeats + 1) * kBeatPeriodFrames;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  for (int b = 0; b < kAccentBeats; ++b) {
    const Beat beat = beat_at(b, meter, phase);
    AddToneBeat(pcm, b, beat.hz, kToneAmp);
    if (beat.extra_hz > 0.0f) AddToneBeat(pcm, b, beat.extra_hz, kToneAmp);
  }
  std::vector<float> mono(pcm.size() / 2);
  for (size_t f = 0; f < mono.size(); ++f) mono[f] = pcm[f * 2];
  return mono;
}

int BarOneOf(BeatAt beat_at, int meter, int phase) {
  const std::vector<float> mono = MakeMono(beat_at, meter, phase);
  const std::vector<int> db = FindDownbeats(
      mono.data(),
      static_cast<int>(mono.size()),
      static_cast<int>(kSampleRate),
      StandOutGrid(),
      meter
  );
  return db.empty() ? -1 : db[0] % meter;
}

void CheckAccentPhases(int meter) {
  for (int phase = 0; phase < meter; ++phase) {
    const int found = BarOneOf(AccentBeat, meter, phase);
    std::printf(
        "analyze_verify: %d/4 accent on beat index %d -> bar one at %d\n",
        meter,
        phase,
        found
    );
    Check(found == phase, "accent: bar one lands on the stand-out beat");
  }
}

void CheckApproachNote() {
  const int found = BarOneOf(ApproachBeat, kCommonBeatsPerBar, 0);
  std::printf("analyze_verify: beat-4 approach note -> bar one at %d\n", found);
  Check(found == 0, "accent: an approach note on beat 4 keeps bar one on 1");
}

std::vector<double> PhaseSd(
    const std::vector<double>& phases,
    double noise,
    size_t bars = kUnitBars
) {
  const size_t meter = phases.size();
  std::vector<double> sd(meter * bars);
  for (size_t i = 0; i < sd.size(); ++i) {
    const double sign = (i / meter) % 2 == 0 ? 1.0 : -1.0;
    sd[i] = phases[kitbag::PositionAfter(i, static_cast<int>(meter))] +
            sign * noise;
  }
  return sd;
}

void CheckDecision() {
  Check(
      kitbag::BarOnePhase(PhaseSd({1.0, 0.2, 0.5, 0.65}, 0.0), 4, 0) == 0,
      "accent: a raised beat 4 nearer the rest than bar one keeps bar one"
  );
  const std::vector<double> pair = {0.30, 0.31, 0.405, 0.41};
  Check(
      kitbag::BarOnePhase(PhaseSd(pair, 0.0), 4, 3) == 2,
      "accent: a clear pair resolves to its earlier beat"
  );
  Check(
      kitbag::BarOnePhase(PhaseSd(pair, kNoiseAmplitude), 4, 3) == 3,
      "accent: a pair within the bar-to-bar noise keeps QM's choice"
  );
  Check(
      kitbag::BarOnePhase(PhaseSd(pair, kFewBarsNoise, kFewBars), 4, 3) == 3,
      "accent: a clear pair over two bars keeps QM's choice"
  );
  const double level = pair[2];
  const std::vector<double> rounding =
      {pair[0], level, level + kRoundingGap, level + kRoundingGap * 1.1};
  Check(
      kitbag::BarOnePhase(PhaseSd(rounding, 0.0), 4, 3) == 3,
      "accent: a pair clearing the rest by a rounding error keeps QM's choice"
  );
  Check(
      kitbag::BarOnePhase(PhaseSd({1.0, 0.2, 0.25, 0.7}, 0.0), 4, 0) == 3,
      "accent: a beat-4 change over half bar one's reads as a stand-out beat"
  );
}

}  // namespace

std::vector<float> MakePitchAccentMono(int meter, int phase) {
  return MakeMono(AccentBeat, meter, phase);
}

std::vector<float> StandOutGrid() {
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

void RunAccentTests() {
  CheckAccentPhases(kCommonBeatsPerBar);
  CheckAccentPhases(kTripleBeatsPerBar);
  CheckApproachNote();
  CheckDecision();
}

}  // namespace analyze_test
