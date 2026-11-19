#include <array>
#include <cmath>
#include <cstdio>
#include <optional>
#include <vector>

#include "analysis/beat_tracker.h"
#include "analysis/downbeat.h"
#include "analysis/meter.h"
#include "analyze_buffer_driver.h"
#include "analyze_test_support.h"
#include "check.h"

namespace analyze_test {
namespace {

using kitbag::BeatResult;
using kitbag::kCommonBeatsPerBar;
using kitbag::kTripleBeatsPerBar;
using kitbag_test::Check;

constexpr int kMeterBeats = 30;
constexpr int kNonNegativeBias = kMeterBeats;
// Below the ~344 Hz top of the band the downbeat spectral difference reads.
constexpr std::array<float, 5> kBarPitchesHz =
    {110.0f, 164.81f, 130.81f, 196.0f, 146.83f};
constexpr double kGridTempoRatio = 1.5;
// Straddle meter.cpp's 0.5 margin; 12 differences is its four-bar minimum.
constexpr double kLeadBelowMargin = 0.49;
constexpr double kLeadAboveMargin = 0.51;
constexpr double kClearLead = 2.0;
constexpr size_t kLeadLength = 48;
constexpr size_t kMinDetectLength = 12;

enum class Change { kEveryBar, kEveryHalfBar, kNone };

struct MeterFixture {
  const char* name;
  int meter;
  int first_bar_one;
  Change change;
};

// A 4/4 bar whose chord also moves on beat 3 is the case most likely to read
// as some other meter.
constexpr std::array<MeterFixture, 6> kFixtures = {{
    {.name = "3/4",
     .meter = kTripleBeatsPerBar,
     .first_bar_one = 0,
     .change = Change::kEveryBar},
    {.name = "3/4 one-beat pickup",
     .meter = kTripleBeatsPerBar,
     .first_bar_one = 1,
     .change = Change::kEveryBar},
    {.name = "3/4 two-beat pickup",
     .meter = kTripleBeatsPerBar,
     .first_bar_one = 2,
     .change = Change::kEveryBar},
    {.name = "4/4 one-beat pickup",
     .meter = kCommonBeatsPerBar,
     .first_bar_one = 1,
     .change = Change::kEveryBar},
    {.name = "4/4 half-bar change",
     .meter = kCommonBeatsPerBar,
     .first_bar_one = 1,
     .change = Change::kEveryHalfBar},
    {.name = "featureless",
     .meter = kCommonBeatsPerBar,
     .first_bar_one = 0,
     .change = Change::kNone},
}};

int BarOf(int beat, const MeterFixture& fx) {
  const int pos = beat - fx.first_bar_one + kNonNegativeBias * fx.meter;
  const int bar = pos / fx.meter;
  if (fx.change != Change::kEveryHalfBar) return bar;
  return bar * 2 + (pos % fx.meter >= fx.meter / 2 ? 1 : 0);
}

std::vector<float> MakeMeterTrack(const MeterFixture& fx) {
  const int total = (kMeterBeats + 1) * kBeatPeriodFrames;
  std::vector<float> pcm(static_cast<size_t>(total) * 2, 0.0f);
  const float amp = fx.change == Change::kNone ? 0.0f : kToneAmp;
  for (int b = 0; b < kMeterBeats; ++b) {
    AddToneBeat(
        pcm,
        b,
        kBarPitchesHz[BarOf(b, fx) % kBarPitchesHz.size()],
        amp
    );
  }
  return pcm;
}

std::optional<int> ClickBeatAt(float seconds) {
  const double period = static_cast<double>(kBeatPeriodFrames) / kSampleRate;
  const auto beat = static_cast<int>(std::lround(seconds / period));
  const bool on_grid =
      std::fabs(seconds - beat * period) <= kBarOneToleranceSec;
  if (!on_grid || beat < 0 || beat >= kMeterBeats) return std::nullopt;
  return beat;
}

int Spacing(const std::vector<int>& db) {
  if (db.size() < 2) return 0;
  const int spacing = db[1] - db[0];
  for (size_t i = 2; i < db.size(); ++i) {
    if (db[i] - db[i - 1] != spacing) return -1;
  }
  return spacing;
}

struct BarOneTally {
  int on_phase = 0;
  int off_phase = 0;
};

BarOneTally TallyBarOnes(const BeatResult& r, const MeterFixture& fx) {
  BarOneTally tally;
  for (const int idx : r.downbeat_indices) {
    const std::optional<int> click = ClickBeatAt(r.beat_times[idx]);
    if (!click) continue;
    if ((*click - fx.first_bar_one) % fx.meter == 0) {
      ++tally.on_phase;
    } else {
      ++tally.off_phase;
    }
  }
  return tally;
}

void CheckMeter(const MeterFixture& fx) {
  const BeatResult r = AnalyzePcm(MakeMeterTrack(fx));
  const int spacing = Spacing(r.downbeat_indices);
  const std::optional<int> first =
      r.downbeat_indices.empty()
          ? std::nullopt
          : ClickBeatAt(r.beat_times[r.downbeat_indices[0]]);
  std::printf(
      "analyze_verify: meter %s -> bar-ones every %d beats from click %d\n",
      fx.name,
      spacing,
      first.value_or(-1)
  );
  Check(spacing == fx.meter, "meter: bar-ones one detected bar apart");
  if (fx.change != Change::kEveryBar) return;
  const BarOneTally tally = TallyBarOnes(r, fx);
  Check(
      tally.off_phase == 0 &&
          tally.on_phase >= (kMeterBeats - fx.first_bar_one) / fx.meter,
      "meter: every bar-one lands on the fixture's bar-one beats"
  );
}

std::vector<float> ThreeHalvesTempoGrid() {
  const double step =
      static_cast<double>(kBeatPeriodFrames) / kGridTempoRatio / kSampleRate;
  std::vector<float> grid;
  for (int k = 0; k < static_cast<int>(kMeterBeats * kGridTempoRatio); ++k) {
    grid.push_back(static_cast<float>(k * step));
  }
  return grid;
}

// Beautiful Saviour's bass stem tracked at 3/2 tempo and led toward 3 most of
// any real stem; on this fixture 3 leads 4 by only +0.08.
void CheckThreeHalvesGrid() {
  constexpr MeterFixture kCommon = {
      .name = "4/4 on a 3/2-tempo grid",
      .meter = kCommonBeatsPerBar,
      .first_bar_one = 0,
      .change = Change::kEveryBar
  };
  std::vector<float> mono = MakeMeterTrack(kCommon);
  for (size_t f = 0; f < mono.size() / 2; ++f) mono[f] = mono[f * 2];
  mono.resize(mono.size() / 2);
  const int spacing = Spacing(FindDownbeats(
      mono.data(),
      static_cast<int>(mono.size()),
      static_cast<int>(kSampleRate),
      ThreeHalvesTempoGrid(),
      kitbag::kDetectBeatsPerBar
  ));
  std::printf(
      "analyze_verify: meter %s -> every %d beats\n",
      kCommon.name,
      spacing
  );
  Check(spacing == kCommonBeatsPerBar, "meter: 3/2-tempo 4/4 stays 4/4");
}

// Uniform 1 with every third value raised so the 3-beat contrast equals
// `lead`; the 4-beat contrast is 0 over whole 12-beat cycles.
std::vector<double> TripleLead(size_t length, double lead) {
  const double raised = (3.0 + 2.0 * lead) / (3.0 - lead);
  std::vector<double> beat_sd(length, 1.0);
  for (size_t i = kTripleBeatsPerBar - 1; i < length; i += kTripleBeatsPerBar) {
    beat_sd[i] = raised;
  }
  return beat_sd;
}

void CheckDetectThresholds() {
  Check(
      kitbag::DetectBeatsPerBar(TripleLead(kLeadLength, kLeadBelowMargin)) ==
          kCommonBeatsPerBar,
      "meter: a lead just under the margin stays 4"
  );
  Check(
      kitbag::DetectBeatsPerBar(TripleLead(kLeadLength, kLeadAboveMargin)) ==
          kTripleBeatsPerBar,
      "meter: a lead just over the margin reads 3"
  );
  Check(
      kitbag::DetectBeatsPerBar(TripleLead(kMinDetectLength - 1, kClearLead)) ==
          kCommonBeatsPerBar,
      "meter: 11 differences are too short and stay 4"
  );
  Check(
      kitbag::DetectBeatsPerBar(TripleLead(kMinDetectLength, kClearLead)) ==
          kTripleBeatsPerBar,
      "meter: 12 differences are enough to read 3"
  );
}

}  // namespace

void RunMeterTests() {
  for (const MeterFixture& fx : kFixtures) CheckMeter(fx);
  CheckThreeHalvesGrid();
  CheckDetectThresholds();
}

}  // namespace analyze_test
