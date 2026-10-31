// The bar_phase mirror on block-aligned downbeats.
#include <algorithm>
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
constexpr int kCountInBars = 2;
constexpr double kPhaseTolerance = 1e-7;
constexpr int kGridBeats = (kBarsRendered + 1) * kBeatsPerBar;
constexpr int64_t kLoopStart = 24000;
constexpr int64_t kLoopEnd = 60001;
constexpr int64_t kPlayFrom = 40000;
// Due by kGridEpsilon at song frame end - 1, but past the loop's fire limit.
constexpr double kHeldBeatFrame = kLoopEnd - 1 + 3e-5;

enum class StartMode : uint8_t { kStart, kCountIn, kAnchor, kGrid };

struct BarPhaseCase {
  const char* label;
  double bpm;
  uint32_t sample_rate;
  uint32_t block_frames;
  double latency_ms;
  StartMode mode;
};

struct BarPhaseTally {
  int downbeats = 0;
  int count_in_downbeats = 0;
  bool in_range = true;
  bool paired = true;
  bool before_value = true;
  bool before_beat = true;
  bool on_value = true;
  bool on_beat = true;
  bool count_in_bar = true;
};

class BarPhaseRig {
 public:
  explicit BarPhaseRig(const BarPhaseCase& c) : case_(c) {
    metronome_.SetTempo(c.bpm);
    metronome_.SetTimeSignature(kBeatsPerBar, kBeatsPerBar);
    metronome_.SetLatencyOffset(c.latency_ms);
    if (c.mode == StartMode::kGrid) metronome_.SetGrid(MakeGrid(), 0, true);
    if (c.mode == StartMode::kCountIn) {
      metronome_.SetCountIn(kCountInBars, false, 0);
    }
    if (c.mode == StartMode::kAnchor) {
      metronome_.AnchorExternal(0.0, 0, c.bpm);
    } else {
      metronome_.Start();
    }
    buffer_.resize(static_cast<size_t>(c.block_frames) * kChannels);
  }

  int64_t FramesPerBar() const {
    return std::llround(
        kSecondsPerMinute / case_.bpm * case_.sample_rate * kBeatsPerBar
    );
  }

  int64_t DownbeatShiftFrames() const {
    const bool shifted =
        case_.mode == StartMode::kGrid || case_.mode == StartMode::kAnchor;
    return shifted ? std::llround(
                         case_.latency_ms / kMsPerSecond * case_.sample_rate
                     )
                   : 0;
  }

  void RenderAndTally(uint32_t frames) {
    metronome_.Render(
        buffer_.data(),
        frames,
        case_.sample_rate,
        kChannels,
        static_cast<uint64_t>(rendered_)
    );
    rendered_ += frames;
    CheckEveryBlock();
  }

  void CheckBeforeDownbeat() {
    const double expected = 1.0 - 1.0 / static_cast<double>(FramesPerBar());
    tally_.before_value =
        tally_.before_value &&
        std::fabs(metronome_.bar_phase() - expected) < kPhaseTolerance;
    tally_.before_beat =
        tally_.before_beat && metronome_.current_beat() == kLastBeat;
    if (metronome_.trainer_mirrors().counting_in()) {
      ++tally_.count_in_downbeats;
    }
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
  void CheckEveryBlock() {
    const double phase = metronome_.bar_phase();
    tally_.in_range = tally_.in_range && phase >= 0.0 && phase < 1.0;
    const auto phase_beat = static_cast<int>(std::floor(phase * kBeatsPerBar));
    const int beat = metronome_.current_beat();
    const bool none_fired = beat < 0;
    tally_.paired = tally_.paired && (none_fired || phase_beat == beat);
    const auto& mirrors = metronome_.trainer_mirrors();
    if (mirrors.counting_in()) {
      const int64_t last_frame_bar = (rendered_ - 1) / FramesPerBar();
      tally_.count_in_bar =
          tally_.count_in_bar && mirrors.count_in_bar() == last_frame_bar;
    }
  }

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

// A block ending on a downbeat leaves it unrendered.
void RunAcrossDownbeat(BarPhaseRig& rig, uint32_t block_frames) {
  rig.CheckBeforeDownbeat();
  rig.RenderAndTally(1);
  rig.CheckOnDownbeat();
  rig.RenderAndTally(block_frames - 1);
}

BarPhaseTally RenderCase(const BarPhaseCase& c) {
  BarPhaseRig rig(c);
  const int64_t bar = rig.FramesPerBar();
  const int64_t total = bar * kBarsRendered;
  while (rig.rendered() < total) {
    rig.RenderAndTally(c.block_frames);
    const int64_t downbeat_frame = rig.rendered() + rig.DownbeatShiftFrames();
    if (downbeat_frame > 0 && downbeat_frame % bar == 0) {
      RunAcrossDownbeat(rig, c.block_frames);
    }
  }
  return rig.tally();
}

void CheckCountIn(const BarPhaseTally& tally) {
  Check(
      tally.count_in_downbeats == kCountInBars,
      "bar_phase: the count-in crossed both of its bar lines"
  );
  Check(
      tally.count_in_bar,
      "bar_phase: count_in.bar names the bar current_beat sounded in"
  );
}

void CheckCase(const BarPhaseCase& c) {
  const int failures_before = g_failures;
  const BarPhaseTally tally = RenderCase(c);
  Check(
      tally.downbeats >= kMinDownbeatsSeen,
      "bar_phase: the run crossed enough downbeats"
  );
  Check(tally.in_range, "bar_phase: stays in [0, 1) after every block");
  Check(tally.paired, "bar_phase: names the same beat as current_beat");
  Check(
      tally.before_value,
      "bar_phase: block ending on a downbeat reads the bar's last frame"
  );
  Check(tally.before_beat, "bar_phase: the downbeat has not fired early");
  Check(tally.on_value, "bar_phase: reads ~0 once the downbeat renders");
  Check(tally.on_beat, "bar_phase: the downbeat fires on its frame");
  if (c.mode == StartMode::kCountIn) CheckCountIn(tally);
  if (g_failures != failures_before) std::fprintf(stderr, "  in %s\n", c.label);
}

void TestBarPhaseOnBlockAlignedDownbeats() {
  const BarPhaseCase cases[] = {
      {"free run 400 BPM 48k", 400.0, 48000, 256, 0.0, StartMode::kStart},
      {"free run 150 BPM 44.1k +25ms, cancelled by start",
       150.0,
       44100,
       480,
       25.0,
       StartMode::kStart},
      {"anchored 150 BPM 44.1k +20ms",
       150.0,
       44100,
       441,
       20.0,
       StartMode::kAnchor},
      {"count-in 120 BPM 48k", 120.0, 48000, 480, 0.0, StartMode::kCountIn},
      {"grid 400 BPM 48k", 400.0, 48000, 256, 0.0, StartMode::kGrid},
      {"grid 120 BPM 44.1k +20ms", 120.0, 44100, 441, 20.0, StartMode::kGrid},
      {"grid 60 BPM 44.1k -100ms", 60.0, 44100, 441, -100.0, StartMode::kGrid},
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

std::unique_ptr<kitbag::BeatGrid> MakeLoopGrid() {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (double frame : {12000.0, 24000.0, 36000.0, 48000.0, kHeldBeatFrame}) {
    grid->beat_times_sec.push_back(frame / kSampleRate);
  }
  return grid;
}

kitbag::SongClock LoopClock(int64_t first, uint32_t frames) {
  return {
      .playing = true,
      .first = first,
      .frames = frames,
      .layout = {
          .looping = true,
          .start = kLoopStart,
          .end = kLoopEnd,
          .crossfade = 0
      }
  };
}

void TestGridPhaseAtLoopEdge() {
  kitbag::Metronome metronome;
  metronome.SetTimeSignature(kBeatsPerBar, kBeatsPerBar);
  metronome.SetGrid(MakeLoopGrid(), 0, true);
  metronome.SetFollowMixer(true);
  metronome.Start();
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  const int64_t edge = kLoopEnd - kPlayFrom;
  for (int64_t done = 0; done < edge;) {
    const auto frames =
        static_cast<uint32_t>(std::min<int64_t>(kBlockFrames, edge - done));
    const kitbag::SongClock clock = LoopClock(kPlayFrom + done, frames);
    metronome.Render(buffer.data(), frames, kSampleRate, kChannels, 0, &clock);
    done += frames;
  }
  Check(
      metronome.current_beat() == kLastBeat && metronome.bar_phase() < 1.0,
      "bar_phase: a beat held back at a loop's end keeps the phase below 1"
  );
}

}  // namespace

void RunBarPhaseTests() {
  TestBarPhaseOnBlockAlignedDownbeats();
  TestBarFractionJustBelowWrap();
  TestGridPhaseAtLoopEdge();
}

}  // namespace metronome_test
