#include <array>
#include <cmath>
#include <cstdio>
#include <numbers>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analyze_test_support.h"
#include "check.h"

namespace analyze_test {
namespace {

using kitbag::BeatResult;
using kitbag_test::Check;

constexpr int kWaltz = 3;
constexpr int kCommon = 4;
constexpr int kMeterBeats = 30;
// Below the ~344 Hz top of the band the downbeat spectral difference reads.
constexpr std::array<float, 5> kBarPitchesHz =
    {110.0f, 164.81f, 130.81f, 196.0f, 146.83f};
constexpr float kToneAmp = 0.3f;
constexpr int kToneGuardFrames = 200;
constexpr float kBarOneToleranceSec = 0.1f;
constexpr float kTwoPi = 2.0f * std::numbers::pi_v<float>;

struct MeterFixture {
  const char* name;
  int meter;
  int first_bar_one;
  bool half_bar_change;
  bool featureless;
};

// A 4/4 bar whose chord also moves on beat 3 is the case most likely to read
// as some other meter; featureless leaves only the clicks.
constexpr std::array<MeterFixture, 6> kFixtures = {{
    {"3/4", kWaltz, 0, false, false},
    {"3/4 one-beat pickup", kWaltz, 1, false, false},
    {"3/4 two-beat pickup", kWaltz, 2, false, false},
    {"4/4 one-beat pickup", kCommon, 1, false, false},
    {"4/4 half-bar change", kCommon, 1, true, false},
    {"featureless", kCommon, 0, false, true},
}};

int BarOf(int beat, const MeterFixture& fx) {
  const int pos = beat - fx.first_bar_one + fx.meter * kMeterBeats;
  const int bar = pos / fx.meter;
  if (!fx.half_bar_change) return bar;
  return bar * 2 + (pos % fx.meter >= fx.meter / 2 ? 1 : 0);
}

void AddBeat(std::vector<float>& pcm, int beat, const MeterFixture& fx) {
  const int start = beat * kBeatPeriodFrames;
  const float hz = kBarPitchesHz[BarOf(beat, fx) % kBarPitchesHz.size()];
  const float amp = fx.featureless ? 0.0f : kToneAmp;
  for (int s = 0; s < kBeatPeriodFrames - kToneGuardFrames; ++s) {
    const float t = static_cast<float>(s) / static_cast<float>(kSampleRate);
    float v = amp * std::sin(kTwoPi * hz * t);
    if (s < kClickWidth) v += kClickAmp;
    pcm[static_cast<size_t>(start + s) * 2] = v;
    pcm[static_cast<size_t>(start + s) * 2 + 1] = v;
  }
}

std::vector<float> MakeMeterTrack(const MeterFixture& fx) {
  const int total = (kMeterBeats + 1) * kBeatPeriodFrames;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  for (int b = 0; b < kMeterBeats; ++b) AddBeat(pcm, b, fx);
  return pcm;
}

// The click beat a detected beat time sits on, or -1 when it is off the grid
// or in the trailing silence.
int ClickBeatAt(float seconds) {
  const double period = static_cast<double>(kBeatPeriodFrames) / kSampleRate;
  const auto beat = static_cast<int>(std::lround(seconds / period));
  const bool on_grid =
      std::fabs(seconds - beat * period) <= kBarOneToleranceSec;
  return on_grid && beat >= 0 && beat < kMeterBeats ? beat : -1;
}

int Spacing(const std::vector<int>& db) {
  if (db.size() < 2) return 0;
  const int spacing = db[1] - db[0];
  for (size_t i = 2; i < db.size(); ++i) {
    if (db[i] - db[i - 1] != spacing) return -1;
  }
  return spacing;
}

bool OnBarOnes(const BeatResult& r, const MeterFixture& fx, int* bar_ones) {
  *bar_ones = 0;
  for (const int idx : r.downbeat_indices) {
    const int click = ClickBeatAt(r.beat_times[idx]);
    if (click < 0) continue;
    if ((click - fx.first_bar_one) % fx.meter != 0) return false;
    ++*bar_ones;
  }
  return true;
}

void CheckMeter(const MeterFixture& fx) {
  const BeatResult r = AnalyzePcm(MakeMeterTrack(fx));
  const int spacing = Spacing(r.downbeat_indices);
  int bar_ones = 0;
  const bool on_phase = OnBarOnes(r, fx, &bar_ones);
  const int first = r.downbeat_indices.empty()
                        ? -1
                        : ClickBeatAt(r.beat_times[r.downbeat_indices[0]]);
  std::printf(
      "analyze_verify: meter %s -> bar-ones every %d beats from click %d\n",
      fx.name,
      spacing,
      first
  );
  Check(spacing == fx.meter, "meter: bar-ones one detected bar apart");
  if (fx.featureless || fx.half_bar_change) return;
  const int full_bars = (kMeterBeats - fx.first_bar_one) / fx.meter;
  Check(
      on_phase && bar_ones >= full_bars,
      "meter: every bar-one lands on the fixture's bar-one beats"
  );
}

}  // namespace

void RunMeterTests() {
  for (const MeterFixture& fx : kFixtures) CheckMeter(fx);
}

}  // namespace analyze_test
