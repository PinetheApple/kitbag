#include <algorithm>
#include <cmath>
#include <limits>
#include <memory>
#include <string>
#include <vector>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"
#include "metronome_test_grid_offset.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kMsPerSecond;

constexpr double kFirstBeatSec = 0.5;
constexpr int64_t kAttackFrames = 1;
constexpr double kAnchorBpm = 120.0;
// Outlasts a hi-hat accent's tail above the onset threshold (~1160 frames).
constexpr int64_t kHoldFrames = 1500;
constexpr int64_t kTailFrames = kSampleRate;
constexpr double kNeverSounded = -std::numeric_limits<double>::infinity();

struct Segment {
  int64_t start;
  double offset_ms;
  uint64_t anchor_frame;
  int timeline;
};

std::vector<double> TickSeconds(const OffsetChange& change) {
  std::vector<double> ticks;
  for (int beat = 0; beat < kOffsetGridBeats; ++beat) {
    const double beat_sec = BeatSec(change, beat);
    ticks.push_back(beat_sec);
    if (beat + 1 == kOffsetGridBeats) break;
    const double span = BeatSec(change, beat + 1) - beat_sec;
    for (int slot = 1; slot < change.subdivision; ++slot) {
      ticks.push_back(beat_sec + span * slot / change.subdivision);
    }
  }
  return ticks;
}

int64_t
FireFrame(double tick_sec, double offset_ms, uint64_t anchor_frame = 0) {
  return std::llround((tick_sec - offset_ms / kMsPerSecond) * kSampleRate) +
         static_cast<int64_t>(anchor_frame);
}

std::vector<Segment> SegmentsOf(
    const OffsetChange& change,
    std::span<const OffsetStep> steps,
    bool follow
) {
  double offset_ms = change.from_ms;
  uint64_t anchor_frame = 0;
  int timeline = 0;
  std::vector<Segment> segments{{0, follow ? 0.0 : offset_ms, 0, timeline}};
  for (const OffsetStep& step : steps) {
    if (step.kind == StepKind::kOffset) offset_ms = step.offset_ms;
    if (step.kind == StepKind::kFollowOff) follow = false;
    const bool moved =
        step.kind == StepKind::kRepublish && step.anchor_frame != anchor_frame;
    if (moved) anchor_frame = step.anchor_frame;
    if (moved || step.kind == StepKind::kFollowOff ||
        step.kind == StepKind::kRestart ||
        step.kind == StepKind::kStopThenAnchor) {
      ++timeline;
    }
    segments.push_back(
        {step.frame,
         follow ? 0.0 : offset_ms,
         follow ? 0 : anchor_frame,
         timeline}
    );
  }
  return segments;
}

std::unique_ptr<kitbag::BeatGrid>
MakeGrid(const OffsetChange& change, uint64_t anchor_frame) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (int beat = 0; beat < kOffsetGridBeats; ++beat) {
    grid->beat_times_sec.push_back(BeatSec(change, beat));
  }
  grid->anchor_frame = anchor_frame;
  return grid;
}

void StartOnGrid(
    kitbag::Metronome& metronome,
    const OffsetChange& change,
    bool follow
) {
  metronome.SetSounds(kHihatSound, kHihatSound);
  metronome.SetSubdivision(change.subdivision);
  metronome.SetGrid(MakeGrid(change, 0), 0, true);
  metronome.SetLatencyOffset(change.from_ms);
  metronome.SetFollowMixer(follow);
  metronome.Start();
}

void ApplyStep(
    kitbag::Metronome& metronome,
    const OffsetChange& change,
    const OffsetStep& step
) {
  switch (step.kind) {
    case StepKind::kOffset:
      metronome.SetLatencyOffset(step.offset_ms);
      return;
    case StepKind::kRepublish:
      metronome.SetGrid(
          MakeGrid(change, step.anchor_frame),
          static_cast<uint64_t>(step.frame),
          true
      );
      return;
    case StepKind::kFollowOff:
      metronome.SetFollowMixer(false);
      return;
    case StepKind::kRestart:
      metronome.Stop();
      metronome.Start();
      return;
    case StepKind::kStopThenAnchor:
      metronome.Stop();
      metronome
          .AnchorExternal(0.0, static_cast<uint64_t>(step.frame), kAnchorBpm);
      return;
  }
}

void RenderBlock(
    kitbag::Metronome& metronome,
    std::vector<float>* buffer,
    int64_t done
) {
  std::fill(buffer->begin(), buffer->end(), 0.0f);
  const kitbag::SongClock clock{
      .playing = true,
      .first = done,
      .frames = kBlockFrames
  };
  metronome.Render(
      buffer->data(),
      kBlockFrames,
      kSampleRate,
      kChannels,
      static_cast<uint64_t>(done),
      &clock
  );
}

}  // namespace

bool MatchesOneForOne(
    const std::vector<int64_t>& onsets,
    const std::vector<int64_t>& expected,
    std::string* detail
) {
  for (size_t i = 0; i < std::min(onsets.size(), expected.size()); ++i) {
    if (std::llabs(onsets[i] - expected[i]) > kFrameTolerance) {
      *detail = "onset " + std::to_string(i) + " at " +
                std::to_string(onsets[i]) + ", expected " +
                std::to_string(expected[i]);
      return false;
    }
  }
  *detail = std::to_string(onsets.size()) + " onsets, expected " +
            std::to_string(expected.size());
  return onsets.size() == expected.size();
}

double BeatSec(const OffsetChange& change, int beat) {
  const int before_switch = std::min(beat, change.switch_beat);
  return kFirstBeatSec + change.interval_sec * before_switch +
         change.interval_after_switch_sec * (beat - before_switch);
}

std::vector<int64_t>
ExpectedOnsets(const OffsetChange& change, ShiftRule rule) {
  std::vector<int64_t> onsets;
  for (const double tick : TickSeconds(change)) {
    const int64_t old_frame = FireFrame(tick, change.from_ms);
    const int64_t new_frame = FireFrame(tick, change.to_ms);
    const bool sounded = old_frame < change.change_frame;
    if (sounded) onsets.push_back(old_frame + kAttackFrames);
    const bool replays = !sounded || rule == ShiftRule::kReseek;
    if (replays && new_frame >= change.change_frame) {
      onsets.push_back(new_frame + kAttackFrames);
    }
  }
  std::sort(onsets.begin(), onsets.end());
  return onsets;
}

std::vector<int64_t> ExpectedStepOnsets(
    const OffsetChange& change,
    std::span<const OffsetStep> steps,
    bool follow
) {
  const std::vector<Segment> segments = SegmentsOf(change, steps, follow);
  std::vector<int64_t> onsets;
  double last_sounded = kNeverSounded;
  for (size_t i = 0; i < segments.size(); ++i) {
    const Segment& segment = segments[i];
    if (i > 0 && segment.timeline != segments[i - 1].timeline) {
      last_sounded = kNeverSounded;
    }
    const int64_t end = i + 1 < segments.size()
                            ? segments[i + 1].start
                            : std::numeric_limits<int64_t>::max();
    for (const double tick : TickSeconds(change)) {
      const int64_t frame =
          FireFrame(tick, segment.offset_ms, segment.anchor_frame);
      if (frame < segment.start || frame >= end || tick <= last_sounded) {
        continue;
      }
      onsets.push_back(frame + kAttackFrames);
      last_sounded = tick;
    }
  }
  return onsets;
}

size_t CrossedTicks(const OffsetChange& change) {
  size_t crossed = 0;
  for (const double tick : TickSeconds(change)) {
    if (FireFrame(tick, change.from_ms) >= change.change_frame &&
        FireFrame(tick, change.to_ms) < change.change_frame) {
      ++crossed;
    }
  }
  return crossed;
}

OffsetRender RenderOffsetSteps(
    const OffsetChange& change,
    std::span<const OffsetStep> steps,
    bool follow
) {
  kitbag::Metronome metronome;
  StartOnGrid(metronome, change, follow);
  const int64_t total = FireFrame(
                            BeatSec(change, kOffsetGridBeats - 1),
                            -kitbag::Metronome::kMaxLatencyOffsetMs
                        ) +
                        kTailFrames;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  OffsetRender render{{}, std::numeric_limits<double>::infinity()};
  int64_t last = -kHoldFrames;
  float previous = 0.0f;
  for (int64_t done = 0; done < total; done += kBlockFrames) {
    for (const OffsetStep& step : steps) {
      if (step.frame == done) ApplyStep(metronome, change, step);
    }
    RenderBlock(metronome, &buffer, done);
    DetectOnsets(buffer, done, &render.onsets, &last, &previous, kHoldFrames);
    render.min_bar_phase =
        std::min(render.min_bar_phase, metronome.bar_phase());
  }
  return render;
}

OffsetRender RenderOffsetChange(const OffsetChange& change, bool follow) {
  if (change.change_frame == kNoOffsetChange) {
    return RenderOffsetSteps(change, {}, follow);
  }
  const OffsetStep step{
      change.change_frame,
      StepKind::kOffset,
      change.to_ms,
      0
  };
  return RenderOffsetSteps(change, {&step, 1}, follow);
}

}  // namespace metronome_test
