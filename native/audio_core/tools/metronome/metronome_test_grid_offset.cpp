#include <algorithm>
#include <cmath>
#include <memory>
#include <string>
#include <vector>

#include "metronome/metronome_internal.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

using kitbag::metronome_detail::kMsPerSecond;

constexpr double kFullClampMs = kitbag::Metronome::kMaxLatencyOffsetMs;
constexpr double kSmallOffsetMs = 20.0;
constexpr double kFirstBeatSec = 0.5;
constexpr int kGridBeats = 60;
constexpr double kFastIntervalSec = 0.15;
constexpr double kSlowIntervalSec = 0.37;
constexpr int64_t kChangeFrame = int64_t{750} * kBlockFrames;
// Inside the 20 ms before beat 23 of the fast grid, so +20 ms crosses it.
constexpr int64_t kSmallChangeFrame = int64_t{737} * kBlockFrames;
constexpr int64_t kNeverFrame = -1;
constexpr int64_t kAttackFrames = 1;
constexpr int64_t kFrameTolerance = 1;
// Outlasts a hi-hat accent's tail above the onset threshold (~1160 frames).
constexpr int64_t kHoldFrames = 1500;
constexpr int64_t kTailFrames = kSampleRate;
constexpr size_t kIssueCrossedBeats = 4;

struct OffsetChange {
  const char* name;
  double interval_sec;
  double from_ms;
  double to_ms;
  int64_t change_frame;
};

constexpr OffsetChange kChanges[] = {
    {"400 bpm -300 -> +300",
     kFastIntervalSec,
     -kFullClampMs,
     kFullClampMs,
     kChangeFrame},
    {"400 bpm +300 -> -300",
     kFastIntervalSec,
     kFullClampMs,
     -kFullClampMs,
     kChangeFrame},
    {"0.37 s -300 -> +300",
     kSlowIntervalSec,
     -kFullClampMs,
     kFullClampMs,
     kChangeFrame},
    {"0.37 s +300 -> -300",
     kSlowIntervalSec,
     kFullClampMs,
     -kFullClampMs,
     kChangeFrame},
    {"400 bpm 0 -> +20",
     kFastIntervalSec,
     0.0,
     kSmallOffsetMs,
     kSmallChangeFrame},
    {"400 bpm +20 -> 0",
     kFastIntervalSec,
     kSmallOffsetMs,
     0.0,
     kSmallChangeFrame},
};
constexpr const OffsetChange& kIssueCase = kChanges[0];

struct Model {
  std::vector<int64_t> onsets;
  std::vector<int64_t> crossed;
};

double BeatSec(const OffsetChange& change, int beat) {
  return kFirstBeatSec + change.interval_sec * beat;
}

int64_t FireFrame(double beat_sec, double offset_ms) {
  return std::llround((beat_sec - offset_ms / kMsPerSecond) * kSampleRate);
}

Model Expect(const OffsetChange& change) {
  Model model;
  for (int beat = 0; beat < kGridBeats; ++beat) {
    const int64_t old_frame = FireFrame(BeatSec(change, beat), change.from_ms);
    const int64_t new_frame = FireFrame(BeatSec(change, beat), change.to_ms);
    if (old_frame < change.change_frame) {
      model.onsets.push_back(old_frame + kAttackFrames);
    } else if (new_frame >= change.change_frame) {
      model.onsets.push_back(new_frame + kAttackFrames);
    } else {
      model.crossed.push_back(old_frame);
    }
  }
  return model;
}

void StartOnGrid(
    kitbag::Metronome& metronome,
    const OffsetChange& change,
    bool follow
) {
  metronome.SetSounds(kHihatSound, kHihatSound);
  auto grid = std::make_unique<kitbag::BeatGrid>();
  for (int beat = 0; beat < kGridBeats; ++beat) {
    grid->beat_times_sec.push_back(BeatSec(change, beat));
  }
  metronome.SetGrid(std::move(grid), 0, true);
  metronome.SetLatencyOffset(change.from_ms);
  metronome.SetFollowMixer(follow);
  metronome.Start();
}

void RenderBlock(
    kitbag::Metronome& metronome,
    std::vector<float>* buffer,
    int64_t done,
    bool follow
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
      follow ? &clock : nullptr
  );
}

std::vector<int64_t>
RenderOnsets(const OffsetChange& change, int64_t change_frame, bool follow) {
  kitbag::Metronome metronome;
  StartOnGrid(metronome, change, follow);
  const int64_t total =
      FireFrame(BeatSec(change, kGridBeats - 1), -kFullClampMs) + kTailFrames;
  std::vector<float> buffer(static_cast<size_t>(kBlockFrames) * kChannels);
  std::vector<int64_t> onsets;
  int64_t last = -kHoldFrames;
  float previous = 0.0f;
  for (int64_t done = 0; done < total; done += kBlockFrames) {
    if (done == change_frame) metronome.SetLatencyOffset(change.to_ms);
    RenderBlock(metronome, &buffer, done, follow);
    DetectOnsets(buffer, done, &onsets, &last, &previous, kHoldFrames);
  }
  return onsets;
}

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

int64_t LargestGap(const std::vector<int64_t>& onsets) {
  int64_t gap = 0;
  for (size_t i = 1; i < onsets.size(); ++i) {
    gap = std::max(gap, onsets[i] - onsets[i - 1]);
  }
  return gap;
}

std::vector<int64_t>
OnsetsBefore(const std::vector<int64_t>& onsets, int64_t frame) {
  std::vector<int64_t> before;
  for (const int64_t onset : onsets) {
    if (onset < frame) before.push_back(onset);
  }
  return before;
}

void CheckBeatsAndGaps(
    const OffsetChange& change,
    const std::vector<int64_t>& onsets,
    const std::string& label
) {
  const Model model = Expect(change);
  std::string detail;
  const bool on_time = MatchesOneForOne(onsets, model.onsets, &detail);
  CheckCase(
      on_time,
      label + ": every click on its live-offset frame",
      detail.c_str()
  );
  const size_t sounded = kGridBeats - model.crossed.size();
  CheckCase(
      onsets.size() == sounded,
      label + ": exactly the crossed beats are dropped",
      std::to_string(onsets.size()).c_str()
  );
  const double backward_sec =
      std::max(0.0, change.from_ms - change.to_ms) / kMsPerSecond;
  const auto gap_bound = static_cast<int64_t>(
      (2.0 * change.interval_sec + backward_sec) * kSampleRate
  );
  CheckCase(
      LargestGap(onsets) <= gap_bound + kFrameTolerance,
      label + ": no silence beyond the crossed span",
      std::to_string(LargestGap(onsets)).c_str()
  );
}

void CheckOffsetChange(const OffsetChange& change) {
  const std::string label = std::string("grid offset ") + change.name;
  const auto onsets = RenderOnsets(change, change.change_frame, false);
  CheckBeatsAndGaps(change, onsets, label);
  const auto baseline = RenderOnsets(change, kNeverFrame, false);
  Check(
      OnsetsBefore(onsets, change.change_frame) ==
          OnsetsBefore(baseline, change.change_frame),
      (label + ": clicks before the change are untouched").c_str()
  );
}

void TestIssueCaseCrossesFourBeats() {
  Check(
      Expect(kIssueCase).crossed.size() == kIssueCrossedBeats,
      "grid offset model: -300 -> +300 at 400 bpm crosses four beats"
  );
}

void TestFollowIgnoresAMidRunChange() {
  Check(
      RenderOnsets(kIssueCase, kChangeFrame, true) ==
          RenderOnsets(kIssueCase, kNeverFrame, true),
      "grid offset follow: a mid-run change moves no click"
  );
}

}  // namespace

void RunGridOffsetChangeTests() {
  for (const OffsetChange& change : kChanges) CheckOffsetChange(change);
  TestIssueCaseCrossesFourBeats();
  TestFollowIgnoresAMidRunChange();
}

}  // namespace metronome_test
