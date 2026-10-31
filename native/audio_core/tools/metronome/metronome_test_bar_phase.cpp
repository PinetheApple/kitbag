// The bar_phase mirror on block-aligned downbeats (#246): range [0, 1), and
// paired with current_beat on the same rendered frame.
#include <cmath>
#include <limits>
#include <memory>
#include <vector>

#include "metronome/metronome_internal.h"
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::BarFraction;
using kitbag::metronome_detail::kGridEpsilon;
using kitbag::metronome_detail::kMsPerSecond;
using kitbag::metronome_detail::kSecondsPerMinute;

constexpr int kBeatsPerBar = 4;
constexpr int kLastBeat = kBeatsPerBar - 1;
constexpr int kBarsRendered = 12;
constexpr int kMinDownbeatsSeen = 4;
constexpr double kPhaseTolerance = 1e-7;
constexpr int kGridBeats = (kBarsRendered + 1) * kBeatsPerBar;

struct BarPhaseCase {
  const char* label;
  double bpm;
  uint32_t sample_rate;
  uint32_t block_frames;
  double latency_ms;
  bool grid;
};

struct BarPhaseTally {
  int downbeats = 0;
  bool in_range = true;
  bool paired = true;
  bool before_value = true;
  bool before_beat = true;
  bool on_value = true;
  bool on_beat = true;
};

class BarPhaseRig {
 public:
  explicit BarPhaseRig(const BarPhaseCase& c) : case_(c) {
    metronome_.SetTempo(c.bpm);
    metronome_.SetTimeSignature(kBeatsPerBar, kBeatsPerBar);
    metronome_.SetLatencyOffset(c.latency_ms);
    if (c.grid) metronome_.SetGrid(MakeGrid(), 0, true);
    metronome_.Start();
    buffer_.resize(static_cast<size_t>(c.block_frames) * kChannels);
  }

  int64_t FramesPerBar() const {
    return std::llround(
        kSecondsPerMinute / case_.bpm * case_.sample_rate * kBeatsPerBar
    );
  }

  int64_t LatencyFrames() const {
    return case_.grid ? std::llround(
                            case_.latency_ms / kMsPerSecond * case_.sample_rate
                        )
                      : 0;
  }

  void Render(uint32_t frames) {
    metronome_.Render(
        buffer_.data(),
        frames,
        case_.sample_rate,
        kChannels,
        static_cast<uint64_t>(rendered_)
    );
    rendered_ += frames;
    const double phase = metronome_.bar_phase();
    tally_.in_range = tally_.in_range && phase >= 0.0 && phase < 1.0;
    const auto phase_beat = static_cast<int>(std::floor(phase * kBeatsPerBar));
    const int beat = metronome_.current_beat();
    // A positive offset starts the grid past beat 0, so no beat has fired yet.
    tally_.paired = tally_.paired && (beat < 0 || phase_beat == beat);
  }

  void CheckBeforeDownbeat() {
    const double expected = 1.0 - 1.0 / static_cast<double>(FramesPerBar());
    tally_.before_value =
        tally_.before_value &&
        std::fabs(metronome_.bar_phase() - expected) < kPhaseTolerance;
    tally_.before_beat =
        tally_.before_beat && metronome_.current_beat() == kLastBeat;
  }

  void CheckOnDownbeat() {
    ++tally_.downbeats;
    tally_.on_value =
        tally_.on_value && metronome_.bar_phase() < kPhaseTolerance;
    tally_.on_beat = tally_.on_beat && metronome_.current_beat() == 0;
  }

  int64_t rendered() const {
    return rendered_;
  }
  const BarPhaseTally& tally() const {
    return tally_;
  }

 private:
  std::unique_ptr<kitbag::BeatGrid> MakeGrid() const {
    auto grid = std::make_unique<kitbag::BeatGrid>();
    for (int beat = 0; beat < kGridBeats; ++beat) {
      grid->beat_times_sec.push_back(beat * kSecondsPerMinute / case_.bpm);
    }
    return grid;
  }

  BarPhaseCase case_;
  kitbag::Metronome metronome_;
  std::vector<float> buffer_;
  int64_t rendered_ = 0;
  BarPhaseTally tally_;
};

// A block ending on a downbeat leaves it unrendered; a one-frame block then
// renders it, and one frame less realigns the blocks.
void RunAcrossDownbeat(BarPhaseRig& rig, uint32_t block_frames) {
  rig.CheckBeforeDownbeat();
  rig.Render(1);
  rig.CheckOnDownbeat();
  rig.Render(block_frames - 1);
}

BarPhaseTally RenderCase(const BarPhaseCase& c) {
  BarPhaseRig rig(c);
  const int64_t bar = rig.FramesPerBar();
  const int64_t total = bar * kBarsRendered;
  while (rig.rendered() < total) {
    rig.Render(c.block_frames);
    const int64_t downbeat_frame = rig.rendered() + rig.LatencyFrames();
    if (downbeat_frame > 0 && downbeat_frame % bar == 0) {
      RunAcrossDownbeat(rig, c.block_frames);
    }
  }
  return rig.tally();
}

void CheckCase(const BarPhaseCase& c) {
  const int failures_before = g_failures;
  const BarPhaseTally tally = RenderCase(c);
  Check(tally.downbeats >= kMinDownbeatsSeen, c.label);
  Check(tally.in_range, "bar_phase: stays in [0, 1) after every block");
  Check(tally.paired, "bar_phase: names the same beat as current_beat");
  Check(
      tally.before_value,
      "bar_phase: block ending on a downbeat reads the bar's last frame"
  );
  Check(tally.before_beat, "bar_phase: the downbeat has not fired early");
  Check(tally.on_value, "bar_phase: reads ~0 once the downbeat renders");
  Check(tally.on_beat, "bar_phase: the downbeat fires on its frame");
  if (g_failures != failures_before) std::fprintf(stderr, "  in %s\n", c.label);
}

void TestBarPhaseOnBlockAlignedDownbeats() {
  const BarPhaseCase cases[] = {
      {"bar_phase: free run 400 BPM 48k", 400.0, 48000, 256, 0.0, false},
      {"bar_phase: free run 150 BPM 44.1k +25ms",
       150.0,
       44100,
       480,
       25.0,
       false},
      {"bar_phase: grid 400 BPM 48k", 400.0, 48000, 256, 0.0, true},
      {"bar_phase: grid 120 BPM 44.1k +20ms", 120.0, 44100, 441, 20.0, true},
      {"bar_phase: grid 60 BPM 44.1k -100ms", 60.0, 44100, 441, -100.0, true},
  };
  for (const BarPhaseCase& c : cases) CheckCase(c);
}

void TestBarFractionJustBelowWrap() {
  const double position =
      std::nextafter(-kGridEpsilon, -std::numeric_limits<double>::infinity());
  Check(
      BarFraction(position, kBeatsPerBar) < 1.0,
      "bar_phase: a position rounding onto the wrap stays below 1"
  );
}

}  // namespace

void RunBarPhaseTests() {
  TestBarPhaseOnBlockAlignedDownbeats();
  TestBarFractionJustBelowWrap();
}

}  // namespace metronome_test
