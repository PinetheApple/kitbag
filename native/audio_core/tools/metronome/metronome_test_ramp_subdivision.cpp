#include <string>

#include "metronome/metronome_internal.h"
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kSecondsPerMinute;

constexpr int kBeatsPerBar = 4;
constexpr int kDenominator = 4;
constexpr double kIntervalBars = 2.0;
constexpr int kHihatSound = 4;
constexpr double kBpmTolerance = 1e-9;
constexpr int64_t kFrameSlack = 2;
constexpr int64_t kRiseWindowFrames = 32;
constexpr double kMinTickRise = 0.05;

struct TickRun {
  int subdivision;
  double start_bpm;
  double target_bpm;
  double step_bpm;
  double seconds;
  bool ramped;
};

struct Downbeat {
  int64_t frame;
  double bpm;
};

struct Model {
  std::vector<int64_t> ticks;
  std::vector<Downbeat> downbeats;
};

struct SilentTicks {
  int count = 0;
  int64_t first = -1;
};

struct Observed {
  std::vector<float> samples;
  std::vector<Downbeat> downbeats;
};

int64_t TotalFrames(const TickRun& run) {
  return static_cast<int64_t>(run.seconds * kSampleRate);
}

std::string Label(const TickRun& run) {
  char text[96];
  if (run.ramped) {
    std::snprintf(
        text,
        sizeof text,
        "ramp sub %d: %.0f->%.0f by %.0f every %.0f bars",
        run.subdivision,
        run.start_bpm,
        run.target_bpm,
        run.step_bpm,
        kIntervalBars
    );
  } else {
    std::snprintf(
        text,
        sizeof text,
        "constant sub %d: %.0f BPM",
        run.subdivision,
        run.start_bpm
    );
  }
  return text;
}

double BarBpm(const TickRun& run, int bar) {
  if (!run.ramped) return run.start_bpm;
  const auto intervals = static_cast<int64_t>(std::floor(bar / kIntervalBars));
  return ModelTempo(run.start_bpm, run.target_bpm, run.step_bpm, intervals);
}

Model ModelRun(const TickRun& run) {
  Model model;
  const int ticks_per_bar = kBeatsPerBar * run.subdivision;
  double seconds = 0.0;
  for (int bar = 0;; ++bar) {
    const double bpm = BarBpm(run, bar);
    const double tick_seconds = kSecondsPerMinute / (bpm * run.subdivision);
    for (int tick = 0; tick < ticks_per_bar; ++tick) {
      const auto frame = static_cast<int64_t>(
          std::ceil((seconds + tick * tick_seconds) * kSampleRate)
      );
      if (frame >= TotalFrames(run)) return model;
      if (tick == 0) model.downbeats.push_back({frame, bpm});
      if (frame < TotalFrames(run) - kRiseWindowFrames) {
        model.ticks.push_back(frame);
      }
    }
    seconds += ticks_per_bar * tick_seconds;
  }
}

void StartRun(kitbag::Metronome& metronome, const TickRun& run) {
  metronome.SetTempo(run.start_bpm);
  metronome.SetTimeSignature(kBeatsPerBar, kDenominator);
  metronome.SetSubdivision(run.subdivision);
  metronome.SetSounds(kHihatSound, kHihatSound);
  if (run.ramped) {
    metronome.SetRamp(
        true,
        run.start_bpm,
        run.target_bpm,
        run.step_bpm,
        kIntervalBars,
        kRampBars,
        false
    );
  }
  metronome.Start();
}

Observed RenderRun(const TickRun& run) {
  kitbag::Metronome metronome;
  StartRun(metronome, run);
  Observed observed;
  std::vector<float> buffer(kBlockFrames * kChannels);
  int previous = -1;
  for (int64_t start = 0; start < TotalFrames(run); start += kBlockFrames) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    metronome.Render(
        buffer.data(),
        kBlockFrames,
        kSampleRate,
        kChannels,
        static_cast<uint64_t>(start)
    );
    for (uint32_t frame = 0; frame < kBlockFrames; ++frame) {
      observed.samples.push_back(buffer[frame * kChannels]);
    }
    const int beat = metronome.current_beat();
    if (beat == 0 && previous != 0) {
      observed.downbeats.push_back(
          {start + kBlockFrames, metronome.current_bpm()}
      );
    }
    previous = beat;
  }
  return observed;
}

double WindowPeak(const std::vector<float>& samples, int64_t to) {
  double peak = 0.0;
  for (int64_t i = std::max<int64_t>(to - kRiseWindowFrames, 0); i < to; ++i) {
    peak = std::max(peak, std::fabs(static_cast<double>(samples[i])));
  }
  return peak;
}

SilentTicks FindSilentTicks(const Observed& observed, const Model& model) {
  SilentTicks silent;
  for (const int64_t tick : model.ticks) {
    const double before = WindowPeak(observed.samples, tick - kFrameSlack);
    const double after = WindowPeak(observed.samples, tick + kRiseWindowFrames);
    if (after - before >= kMinTickRise) continue;
    if (silent.count == 0) silent.first = tick;
    ++silent.count;
  }
  return silent;
}

bool SameDownbeat(const Downbeat& seen, const Downbeat& model) {
  return seen.frame - kBlockFrames - kFrameSlack <= model.frame &&
         model.frame <= seen.frame + kFrameSlack &&
         std::fabs(seen.bpm - model.bpm) <= kBpmTolerance;
}

size_t FirstMismatchedBar(const Observed& observed, const Model& model) {
  const size_t bars =
      std::min(observed.downbeats.size(), model.downbeats.size());
  for (size_t bar = 0; bar < bars; ++bar) {
    if (!SameDownbeat(observed.downbeats[bar], model.downbeats[bar])) {
      return bar;
    }
  }
  return bars;
}

void CheckCase(bool passed, const std::string& label, const char* detail) {
  if (!passed) std::fprintf(stderr, "  %s: %s\n", label.c_str(), detail);
  Check(passed, label.c_str());
}

void ExpectEveryTick(
    const TickRun& run,
    const Model& model,
    const Observed& observed
) {
  const SilentTicks silent = FindSilentTicks(observed, model);
  char detail[96];
  std::snprintf(
      detail,
      sizeof detail,
      "first missing tick at frame %lld (%d later model ticks unmatched)",
      static_cast<long long>(silent.first),
      silent.count - 1
  );
  CheckCase(silent.count == 0, Label(run), detail);
}

void ExpectDownbeats(
    const TickRun& run,
    const Model& model,
    const Observed& observed
) {
  char detail[96];
  std::snprintf(
      detail,
      sizeof detail,
      "%zu downbeats, expected %zu",
      observed.downbeats.size(),
      model.downbeats.size()
  );
  CheckCase(
      observed.downbeats.size() == model.downbeats.size(),
      Label(run),
      detail
  );
  if (!run.ramped) return;
  const size_t bar = FirstMismatchedBar(observed, model);
  const bool matched =
      bar == std::min(observed.downbeats.size(), model.downbeats.size());
  std::snprintf(
      detail,
      sizeof detail,
      "bar %zu does not land at its model frame and BPM",
      bar
  );
  CheckCase(matched, Label(run), detail);
}

void ExpectRun(const TickRun& run) {
  const Model model = ModelRun(run);
  const Observed observed = RenderRun(run);
  ExpectEveryTick(run, model, observed);
  ExpectDownbeats(run, model, observed);
}

}  // namespace

void RunRampSubdivisionTests() {
  for (const int subdivision : {2, 3, 4, 6}) {
    ExpectRun({subdivision, 100.0, 120.0, 5.0, 60.0, true});
  }
  ExpectRun({4, 120.0, 100.0, 5.0, 60.0, true});
  ExpectRun({2, 110.0, 110.0, 0.0, 40.0, false});
  ExpectRun(
      {kitbag::Metronome::kMaxSubdivision,
       kitbag::kMaxBpm,
       kitbag::kMaxBpm,
       0.0,
       40.0,
       false}
  );
}

}  // namespace metronome_test
