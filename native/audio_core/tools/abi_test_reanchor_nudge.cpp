#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

#include "abi_test_engine_clock.h"
#include "abi_test_render.h"
#include "check.h"
#include "time_units.h"

namespace abi_test {
namespace {

using kitbag_test::Check;

constexpr double kBpm = 120.0;
constexpr uint32_t kBlockFrames = 64;
constexpr double kLevel = 0.05;
// An accented tick stays above kLevel for ~530 frames; every backward nudge
// below re-fires further apart than this, so a second onset is a second click.
constexpr int64_t kHoldFrames = 560;
constexpr int kBeatsBefore = 2;
constexpr int kBeatsTotal = 6;
constexpr double kOnLineFrames = 4.0;
constexpr double kMsPerSecond = 1000.0;

struct Nudge {
  double from_beat_ms;
  double error_ms;
};

// Negative from_beat_ms re-anchors before beat kBeatsBefore, positive after;
// negative error_ms puts the song behind the click, positive ahead.
constexpr Nudge kNudges[] = {
    {1.3, -20.0},
    {3.0, -20.0},
    {0.5, -15.0},
    {0.5, -13.0},
    {-0.5, 1.0},
    {-1.0, 3.0},
    {-3.0, 10.0},
    {-8.0, 10.0},
    {-12.0, 20.0},
};

double BeatFrames(uint32_t rate) {
  return kitbag::kSecondsPerMinute / kBpm * rate;
}

std::vector<int64_t> RenderReanchored(
    kb_engine* engine,
    double anchor_frame,
    double error_sec,
    double total_frames
) {
  std::vector<int64_t> onsets;
  const double rate = kb_engine_sample_rate(engine);
  int64_t frame = 0;
  float previous = 0.0F;
  bool anchored = false;
  while (static_cast<double>(frame) < total_frames) {
    if (!anchored && static_cast<double>(frame) >= anchor_frame) {
      const double pos = static_cast<double>(frame) / rate + error_sec;
      kb_metronome_anchor_external(engine, pos, frame, kBpm);
      anchored = true;
    }
    const std::vector<float> out = Render(engine, kBlockFrames);
    for (uint32_t i = 0; i < kBlockFrames; ++i) {
      const float level = std::fabs(out[static_cast<size_t>(i) * kChannels]);
      const int64_t at = frame + i;
      const bool held = !onsets.empty() && at - onsets.back() < kHoldFrames;
      if (level > kLevel && previous <= kLevel && !held) onsets.push_back(at);
      previous = level;
    }
    frame += kBlockFrames;
  }
  return onsets;
}

kb_engine* AnchoredEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_set_beats(engine, 4, 4);
  kb_metronome_anchor_external(engine, 0.0, 0, kBpm);
  return engine;
}

bool OneOnsetPerBeat(const std::vector<int64_t>& onsets, double beat_frames) {
  if (onsets.size() != static_cast<size_t>(kBeatsTotal)) {
    std::fprintf(
        stderr,
        "  %zu onsets for %d beats\n",
        onsets.size(),
        kBeatsTotal
    );
    return false;
  }
  for (size_t i = 0; i < onsets.size(); ++i) {
    if (std::llround(static_cast<double>(onsets[i]) / beat_frames) !=
        static_cast<int64_t>(i)) {
      return false;
    }
  }
  return true;
}

bool NudgeKeepsEveryBeatOnce(const Nudge& nudge) {
  kb_engine* engine = AnchoredEngine();
  if (engine == nullptr) return false;
  const uint32_t rate = kb_engine_sample_rate(engine);
  const double beat = BeatFrames(rate);
  const double anchor_at =
      kBeatsBefore * beat + nudge.from_beat_ms * rate / kMsPerSecond;
  const double error_sec = nudge.error_ms / kMsPerSecond;
  const std::vector<int64_t> onsets = RenderReanchored(
      engine,
      anchor_at,
      error_sec,
      (kBeatsTotal - 0.5) * beat
  );
  kb_engine_destroy(engine);
  const double last_on_new = (kBeatsTotal - 1) * beat - error_sec * rate;
  return OneOnsetPerBeat(onsets, beat) &&
         std::fabs(static_cast<double>(onsets.back()) - last_on_new) <=
             kOnLineFrames;
}

void TestNudgesFireEachBeatOnce() {
  bool all = true;
  for (const Nudge& nudge : kNudges) {
    const bool kept = NudgeKeepsEveryBeatOnce(nudge);
    if (!kept) {
      std::fprintf(
          stderr,
          "  nudge %+.1f ms from the beat, error %+.1f ms\n",
          nudge.from_beat_ms,
          nudge.error_ms
      );
    }
    all &= kept;
  }
  Check(
      all,
      "re-anchor nudge: a 1-20 ms correction just before or after a beat "
      "sounds every beat exactly once, then follows the new line"
  );
}

void TestSeekFiresNoBurst() {
  constexpr double kSeekBeats = 4.6;
  kb_engine* engine = AnchoredEngine();
  if (engine == nullptr) return;
  const uint32_t rate = kb_engine_sample_rate(engine);
  const double beat = BeatFrames(rate);
  const double seek_sec = kSeekBeats * beat / rate;
  const double anchor_at = (kBeatsBefore + 0.25) * beat;
  const std::vector<int64_t> onsets =
      RenderReanchored(engine, anchor_at, seek_sec, (kBeatsTotal - 0.5) * beat);
  kb_engine_destroy(engine);
  std::vector<double> expected;
  for (int n = 0; n <= kBeatsBefore; ++n) expected.push_back(n * beat);
  for (int n = 0; n < 2 * kBeatsTotal; ++n) {
    const double frame = n * beat - seek_sec * rate;
    if (frame >= anchor_at && frame < (kBeatsTotal - 0.5) * beat) {
      expected.push_back(frame);
    }
  }
  bool on_beats = onsets.size() == expected.size();
  for (size_t i = 0; on_beats && i < onsets.size(); ++i) {
    on_beats = std::fabs(static_cast<double>(onsets[i]) - expected[i]) <=
               kOnLineFrames + kBlockFrames;
  }
  Check(
      on_beats,
      "re-anchor seek: jumping beats ahead fires none of the skipped beats"
  );
}

}  // namespace

void RunReanchorNudgeAbiTests() {
  TestNudgesFireEachBeatOnce();
  TestSeekFiresNoBurst();
}

}  // namespace abi_test
