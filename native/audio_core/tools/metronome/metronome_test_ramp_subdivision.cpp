#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr int kBeatsPerBar = 4;
constexpr double kIntervalBars = 2.0;
constexpr double kRunSeconds = 60.0;
constexpr double kSecondsPerMinute = 60.0;
constexpr double kBpmTolerance = 1e-9;
constexpr int64_t kFrameSlack = 2;

struct SubdividedRamp {
  int subdivision;
  double start_bpm;
  double target_bpm;
  double step_bpm;
  const char* label;
};

struct Downbeat {
  int64_t frame;
  double bpm;
};

struct Observed {
  std::vector<Downbeat> downbeats;
  bool beats_in_order = true;
};

double ModelBarBpm(const SubdividedRamp& ramp, int bar) {
  const double span = std::fabs(ramp.target_bpm - ramp.start_bpm);
  const double moved =
      std::min(std::floor(bar / kIntervalBars) * ramp.step_bpm, span);
  return ramp.target_bpm >= ramp.start_bpm ? ramp.start_bpm + moved
                                           : ramp.start_bpm - moved;
}

std::vector<Downbeat> ModelDownbeats(const SubdividedRamp& ramp) {
  std::vector<Downbeat> downbeats;
  double seconds = 0.0;
  for (int bar = 0; seconds < kRunSeconds; ++bar) {
    const double bpm = ModelBarBpm(ramp, bar);
    downbeats.push_back({std::llround(seconds * kSampleRate), bpm});
    seconds += kBeatsPerBar * kSecondsPerMinute / bpm;
  }
  return downbeats;
}

Observed RenderBeats(const SubdividedRamp& ramp) {
  kitbag::Metronome metronome;
  metronome.SetTempo(ramp.start_bpm);
  metronome.SetSubdivision(ramp.subdivision);
  metronome.SetRamp(
      true,
      ramp.start_bpm,
      ramp.target_bpm,
      ramp.step_bpm,
      kIntervalBars,
      kRampBars,
      false
  );
  metronome.Start();
  Observed observed;
  int previous = -1;
  const auto total = static_cast<int64_t>(kRunSeconds * kSampleRate);
  RenderContinuous(metronome, total, [&](int64_t block_start) {
    const int beat = metronome.current_beat();
    if (beat == previous) return;
    if (beat != (previous + 1) % kBeatsPerBar) observed.beats_in_order = false;
    if (beat == 0) {
      observed.downbeats.push_back({block_start, metronome.current_bpm()});
    }
    previous = beat;
  });
  return observed;
}

bool SameDownbeat(const Downbeat& seen, const Downbeat& model) {
  return seen.frame - kBlockFrames - kFrameSlack <= model.frame &&
         model.frame <= seen.frame + kFrameSlack &&
         std::fabs(seen.bpm - model.bpm) <= kBpmTolerance;
}

bool StepsLandOnNamedBars(
    const Observed& observed,
    const std::vector<Downbeat>& model
) {
  for (size_t bar = 0; bar < model.size() && bar < observed.downbeats.size();
       ++bar) {
    if (SameDownbeat(observed.downbeats[bar], model[bar])) continue;
    std::fprintf(
        stderr,
        "  bar %zu: downbeat by frame %lld at %.1f BPM, expected frame %lld at "
        "%.1f\n",
        bar,
        static_cast<long long>(observed.downbeats[bar].frame),
        observed.downbeats[bar].bpm,
        static_cast<long long>(model[bar].frame),
        model[bar].bpm
    );
    return false;
  }
  return observed.downbeats.size() == model.size();
}

void CheckCase(bool passed, const SubdividedRamp& ramp, const char* property) {
  if (!passed) std::fprintf(stderr, "  %s: %s\n", ramp.label, property);
  Check(passed, ramp.label);
}

void ExpectEveryDownbeat(const SubdividedRamp& ramp) {
  const auto model = ModelDownbeats(ramp);
  const Observed observed = RenderBeats(ramp);
  CheckCase(observed.beats_in_order, ramp, "a beat was skipped");
  if (observed.downbeats.size() != model.size()) {
    std::fprintf(
        stderr,
        "  %s: %zu downbeats, expected %zu\n",
        ramp.label,
        observed.downbeats.size(),
        model.size()
    );
  }
  Check(observed.downbeats.size() == model.size(), ramp.label);
  CheckCase(
      StepsLandOnNamedBars(observed, model),
      ramp,
      "a step missed its bar"
  );
}

}  // namespace

void RunRampSubdivisionTests() {
  const SubdividedRamp
      issue{4, 100.0, 120.0, 5.0, "ramp sub 4: 100->120 +5/2 bars"};
  Check(
      ModelDownbeats(issue).size() == 30,
      "ramp sub model: 60 s of 100->120 holds 30 bars"
  );
  ExpectEveryDownbeat({2, 100.0, 120.0, 5.0, "ramp sub 2: 100->120 +5/2 bars"});
  ExpectEveryDownbeat({3, 100.0, 120.0, 5.0, "ramp sub 3: 100->120 +5/2 bars"});
  ExpectEveryDownbeat(issue);
  ExpectEveryDownbeat({6, 100.0, 120.0, 5.0, "ramp sub 6: 100->120 +5/2 bars"});
  ExpectEveryDownbeat({4, 120.0, 100.0, 5.0, "ramp sub 4: 120->100 -5/2 bars"});
}

}  // namespace metronome_test
