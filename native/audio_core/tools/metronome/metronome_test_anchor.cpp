// anchor_external: locking the click to a transport this engine does not clock,
// and re-anchoring it mid-run without a glitch (SPEC.md §4.2, issue [C3]).
#include <cstdlib>
#include <functional>

#include "metronome_test_support.h"

namespace metronome_test {
namespace {

// Beat onset times for an anchor, computed straight from the contract: song
// beat 0 at song second 0, beats every 60/bpm, the click fired latency_ms early.
// Only beats at or after the song's beat 0 sound; the rest are the boundary.
std::vector<double> AnchorBeatSeconds(
    double song_pos_sec,
    int64_t at_frame,
    double bpm,
    double latency_ms,
    int64_t total_frames
) {
  std::vector<double> out;
  const double beat_period_sec = 60.0 / bpm;
  const double latency_frames = latency_ms * kSampleRate / 1000.0;
  for (int n = 0;; ++n) {
    const double frame = static_cast<double>(at_frame) +
                         (n * beat_period_sec - song_pos_sec) * kSampleRate -
                         latency_frames;
    if (frame >= static_cast<double>(total_frames)) break;
    if (frame >= 0.0) out.push_back(frame / kSampleRate);
  }
  return out;
}

// A single anchor lays the click on the song's beats. The phase is deliberately
// off the frame-0 grid, so an impl that ignores song_pos/at_frame is caught.
void TestAnchorSingle() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(1.1, 12000, 120.0);

  const int64_t total = kSampleRate * 3;
  const auto onsets = RenderAndDetectOnsets(metronome, total);
  Check(metronome.is_running(), "anchor: the click runs after an anchor");
  Check(
      !onsets.empty() && onsets[0] > kBlockFrames,
      "anchor: first click at the anchored phase, not frame 0"
  );
  ExpectOnsetsAtSeconds(
      onsets,
      AnchorBeatSeconds(1.1, 12000, 120.0, 0.0, total),
      "anchor single"
  );
}

// A negative song_pos_sec is a pre-roll: the click stays silent until the song
// reaches beat 0. at_frame is chosen so negative beats fall on positive engine
// frames, so an impl missing the silence-before-beat-0 rule sounds early.
void TestAnchorNegativeSongPos() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(-1.1, 48000, 120.0);

  const int64_t total = kSampleRate * 7 / 2;
  const auto onsets = RenderAndDetectOnsets(metronome, total);
  Check(
      !onsets.empty() && onsets[0] > static_cast<int64_t>(1.9 * kSampleRate),
      "anchor negative: silent until the song reaches beat 0"
  );
  ExpectOnsetsAtSeconds(
      onsets,
      AnchorBeatSeconds(-1.1, 48000, 120.0, 0.0, total),
      "anchor negative song_pos"
  );
}

constexpr int64_t kSwapAt = 78000;
constexpr int64_t kConsistentTotal = kSampleRate * 18 / 5;

// Re-anchors to the identical line at the first block past kSwapAt: the same
// song position the original anchor implies, so the phase must not move.
struct ConsistentReanchor {
  kitbag::Metronome* metronome;
  bool done = false;
  void operator()(int64_t frame) {
    if (done || frame < kSwapAt) return;
    metronome->AnchorExternal(
        0.1 + static_cast<double>(frame) / kSampleRate,
        static_cast<uint64_t>(frame),
        120.0
    );
    done = true;
  }
};

// The heart of [C3]: a re-anchor to the same timeline drops no beat and shifts
// none — the onsets are exactly those of an unbroken run.
void TestReanchorConsistentKeepsOnsets() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(0.1, 0, 120.0);
  ConsistentReanchor swap{&metronome};
  const auto onsets =
      RenderContinuous(metronome, kConsistentTotal, std::ref(swap));
  ExpectOnsetsAtSeconds(
      onsets,
      AnchorBeatSeconds(0.1, 0, 120.0, 0.0, kConsistentTotal),
      "re-anchor consistent: onsets unchanged"
  );
}

// A duplicate click at the re-anchor lands within the onset hold window, so
// only the block envelope sees it: between beat 67200 and 91200 the peak, and a
// re-fire at the swap block (305), spikes far above the decaying tail.
void TestReanchorConsistentNoRefire() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(0.1, 0, 120.0);
  ConsistentReanchor swap{&metronome};
  const auto peaks =
      RenderContinuousPeaks(metronome, kConsistentTotal, std::ref(swap));
  ExpectDecayingBlocks(
      peaks,
      300,
      316,
      "re-anchor consistent: no click re-fired at the swap"
  );
}

// Old beats sounded before `swap_frame`, then the new line from the swap on:
// what "future targets only" means, computed independently of the engine.
std::vector<double>
ShiftedExpected(int64_t swap_frame, double new_song_pos, int64_t total) {
  std::vector<double> expected;
  for (int n = 0;; ++n) {
    const double frame = (n * 0.5 - 0.1) * kSampleRate;
    if (frame >= static_cast<double>(swap_frame)) break;
    if (frame >= 0.0) expected.push_back(frame / kSampleRate);
  }
  for (int n = 0;; ++n) {
    const double frame = static_cast<double>(swap_frame) +
                         (n * 0.5 - new_song_pos) * kSampleRate;
    if (frame >= static_cast<double>(total)) break;
    if (frame >= static_cast<double>(swap_frame)) {
      expected.push_back(frame / kSampleRate);
    }
  }
  return expected;
}

// A re-anchor to a shifted timeline moves only future clicks: beats already
// sounded stay put, and the beats after the swap follow the new line.
void TestReanchorShiftedTouchesFutureOnly() {
  const int64_t swap_at = 78000;
  const int64_t total = kSampleRate * 7 / 2;
  constexpr double kShiftSec = 0.2;

  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(0.1, 0, 120.0);
  int64_t swap_frame = -1;
  double new_song_pos = 0.0;
  const auto onsets = RenderContinuous(metronome, total, [&](int64_t frame) {
    if (swap_frame < 0 && frame >= swap_at) {
      swap_frame = frame;
      new_song_pos = 0.1 + static_cast<double>(frame) / kSampleRate + kShiftSec;
      metronome
          .AnchorExternal(new_song_pos, static_cast<uint64_t>(frame), 120.0);
    }
  });

  Check(
      !onsets.empty() &&
          std::fabs(static_cast<double>(onsets[0]) / kSampleRate - 0.4) < 0.02,
      "re-anchor shifted: a beat before the swap is untouched"
  );
  ExpectOnsetsAtSeconds(
      onsets,
      ShiftedExpected(swap_frame, new_song_pos, total),
      "re-anchor shifted future-only"
  );
}

// song_pos_sec exactly 0.0 sits the anchor's beat 0 on song second 0 — the
// >= 0 firing boundary. Beat 0 must fire, not be swallowed, and nothing before.
void TestAnchorSongPosZero() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(0.0, 24000, 120.0);

  // Off the beat grid (beats every 24000): the harness over-renders to the
  // block boundary, which would catch a beat landing exactly at total.
  const int64_t total = 132000;
  const auto onsets = RenderAndDetectOnsets(metronome, total);
  Check(
      !onsets.empty() && std::llabs(onsets[0] - 24000) <= 4,
      "anchor song_pos 0: beat 0 fires on song second 0, nothing before"
  );
  ExpectOnsetsAtSeconds(
      onsets,
      AnchorBeatSeconds(0.0, 24000, 120.0, 0.0, total),
      "anchor song_pos 0"
  );
}

// A whole-beat-negative offset (-0.5 s at 120 BPM = exactly -1 beat) lands the
// boundary on an integer beat: beat -1 at frame 0 is negative and silent, beat 0
// still fires. Guards the epsilon handling at an exact negative integer beat.
void TestAnchorWholeBeatNegative() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.AnchorExternal(-0.5, 0, 120.0);

  const int64_t total = 132000;  // off the beat grid; see TestAnchorSongPosZero
  const auto onsets = RenderAndDetectOnsets(metronome, total);
  Check(
      !onsets.empty() && std::llabs(onsets[0] - 24000) <= 4,
      "anchor whole-beat negative: beat -1 is silent, beat 0 fires at 24000"
  );
  ExpectOnsetsAtSeconds(
      onsets,
      AnchorBeatSeconds(-0.5, 0, 120.0, 0.0, total),
      "anchor whole-beat negative"
  );
}

// Whether an onset lands within `tol` of `target`.
bool OnsetNear(
    const std::vector<int64_t>& onsets,
    int64_t target,
    int64_t tol
) {
  for (const int64_t onset : onsets) {
    if (std::llabs(onset - target) <= tol) return true;
  }
  return false;
}

// A subdivision fired in the pre-beat-0 region (positive latency pulls
// beat_position_ negative while position is not) is owned by beat 0, not by the
// out-of-bounds accents_[-1]. Its presence must track beat 0's accent; if it
// read accents_[-1] instead, beat 0's mute would not reach it.
std::vector<int64_t> RenderPreBeatSubdivision(kitbag::Accent beat_zero) {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetSubdivision(2);
  metronome.SetLatencyOffset(
      100.0
  );  // 0.667 beats at 400 BPM, past the 0.5 sub
  metronome.SetAccent(0, beat_zero);
  metronome.AnchorExternal(-0.045, 0, 400.0);
  return RenderAndDetectOnsets(metronome, kSampleRate / 8);
}

void TestSubdivisionOwnedByBeatZero() {
  constexpr int64_t kSubFrame = 960;  // where the pre-beat-0 subdivision fires
  const auto sounding = RenderPreBeatSubdivision(kitbag::Accent::kNormal);
  const auto muted = RenderPreBeatSubdivision(kitbag::Accent::kMuted);
  Check(
      OnsetNear(sounding, kSubFrame, 8),
      "pre-beat-0 subdivision: sounds when beat 0 is not muted"
  );
  Check(
      !OnsetNear(muted, kSubFrame, 8),
      "pre-beat-0 subdivision: beat 0's mute silences it (owned by beat 0)"
  );
}

// The latency offset composes with the anchor: the click fires early by the
// offset so it lands on the beat at the speaker, not the buffer (§4.7).
void TestAnchorComposesWithLatency() {
  for (const double offset_ms : {100.0, -50.0}) {
    kitbag::Metronome metronome;
    metronome.SetBeatsPerBar(4);
    metronome.SetLatencyOffset(offset_ms);
    metronome.AnchorExternal(0.1, 0, 120.0);

    const int64_t total = kSampleRate * 3;
    const auto onsets = RenderAndDetectOnsets(metronome, total);
    ExpectOnsetsAtSeconds(
        onsets,
        AnchorBeatSeconds(0.1, 0, 120.0, offset_ms, total),
        "anchor + latency offset"
    );
  }
}

}  // namespace

void RunAnchorTests() {
  TestAnchorSingle();
  TestAnchorNegativeSongPos();
  TestAnchorSongPosZero();
  TestAnchorWholeBeatNegative();
  TestSubdivisionOwnedByBeatZero();
  TestReanchorConsistentKeepsOnsets();
  TestReanchorConsistentNoRefire();
  TestReanchorShiftedTouchesFutureOnly();
  TestAnchorComposesWithLatency();
}

}  // namespace metronome_test
