// The sample-accurate start seam (SPEC.md §4.2): anchoring, cancellation and
// the interactions that made the deferred path diverge from the immediate one.
#include "metronome_test_support.h"

namespace metronome_test {
namespace {

constexpr int64_t kMidBlockAnchor = 5000;  // not a multiple of kBlockFrames

// StartAt must fire the first click on its exact engine frame, even mid-block.
void TestStartAt() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.StartAt(static_cast<uint64_t>(kMidBlockAnchor));

  const auto onsets =
      RenderAndDetectOnsets(metronome, kMidBlockAnchor + kSampleRate * 2);
  Check(!onsets.empty(), "start_at: the click actually starts");
  // The click's sine attacks from zero, so the threshold crossing lands one or
  // two samples after the anchor — never before it.
  Check(
      !onsets.empty() && onsets[0] >= kMidBlockAnchor &&
          onsets[0] <= kMidBlockAnchor + 2,
      "start_at: first click on the anchor frame, not the call site"
  );
  ExpectSpacing(
      onsets,
      0,
      onsets.size(),
      60.0 / 120.0 * kSampleRate,
      "start_at 120 BPM after anchored start"
  );
}

// An anchor at or before the first rendered frame fires on frame 0, never
// retroactively — the same branch that handles an already-past anchor.
void TestStartAtAnchorAtZero() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.StartAt(0);

  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate);
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "start_at(0): first click at frame 0"
  );
}

// Regression: a deferred start must recompute the block's tempo derivatives
// after the in-loop BeginRun, or a stale offset swallows beat 0 (SPEC.md §4.7).
void TestStartAtWithArmedRampRecomputesLocals() {
  kitbag::Metronome metronome;
  metronome.SetBeatsPerBar(4);
  metronome.SetRamp(true, 60.0, 180.0, 4);
  metronome.SetLatencyOffset(50.0);
  metronome.Start();
  RenderAndDetectOnsets(metronome, kSampleRate * 6);  // let bpm_ climb past 60
  metronome.Stop();  // leaves the ramp armed and bpm_ high

  metronome.StartAt(static_cast<uint64_t>(kMidBlockAnchor));
  const auto onsets =
      RenderAndDetectOnsets(metronome, kMidBlockAnchor + kSampleRate * 3);
  // Beat 0 must fire on the anchor, and the first bar replays at ramp_start
  // (60 BPM = 48000 frames/beat), not at the stale high bpm_.
  Check(
      !onsets.empty() && onsets[0] >= kMidBlockAnchor &&
          onsets[0] <= kMidBlockAnchor + 2,
      "start_at+ramp: beat 0 fires on the anchor, not swallowed"
  );
  Check(onsets.size() >= 3, "start_at+ramp: enough clicks to measure spacing");
  ExpectSpacing(
      onsets,
      0,
      3,
      60.0 / 60.0 * kSampleRate,
      "start_at+ramp: first bar at ramp start tempo, not stale bpm"
  );
}

// Queued together: kStart begins immediately, then kStartAt sees running_ and
// is dropped, so the run is continuous from frame 0 and unshifted.
void TestStartAtIgnoredWhileRunning() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.Start();
  metronome.StartAt(kSampleRate);  // would move the start out, if honoured
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(
      onsets.size() == 4,
      "start_at while running: ignored, run stays continuous"
  );
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "start_at while running: first click still at frame 0"
  );
}

// Ordering is the point: the pending start must already exist when kStart
// drains, which is the only path that reaches its has_pending_start_ reset.
void TestStartCancelsPendingStartAt() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.StartAt(kSampleRate);  // one second out...
  metronome.Start();               // ...but this pre-empts it
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(
      !onsets.empty() && onsets[0] < kOnsetHoldFrames,
      "start cancels pending start_at: first click at frame 0, not the anchor"
  );
  Check(
      onsets.size() == 4,
      "start cancels pending start_at: full continuous run, no second start"
  );
}

// A latency offset must not swallow beat 0 on the deferred path either — the
// immediate path is pinned by TestLatencyOffsetKeepsBeatZero.
void TestStartAtKeepsBeatZeroUnderLatencyOffset() {
  for (const double offset_ms : {0.5, 100.0, -100.0}) {
    kitbag::Metronome metronome;
    metronome.SetTempo(120.0);
    metronome.SetLatencyOffset(offset_ms);
    metronome.StartAt(static_cast<uint64_t>(kMidBlockAnchor));

    const auto onsets =
        RenderAndDetectOnsets(metronome, kMidBlockAnchor + kSampleRate * 2);
    Check(
        !onsets.empty() && onsets[0] >= kMidBlockAnchor &&
            onsets[0] <= kMidBlockAnchor + 2,
        "start_at + latency offset: beat 0 fires on the anchor"
    );
    ExpectSpacing(
        onsets,
        0,
        onsets.size(),
        60.0 / 120.0 * kSampleRate,
        "start_at + latency offset spacing"
    );
  }
}

constexpr int64_t kRecallAt = 40000;  // mid-run, after several beats emitted
constexpr uint64_t kRecallFrame = 60000;  // would restart here if honoured

std::vector<int64_t> RunStartAtRecall(bool recall) {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.SetBeatsPerBar(4);
  metronome.StartAt(static_cast<uint64_t>(kMidBlockAnchor));
  if (!recall) return RenderAndDetectOnsets(metronome, kSampleRate * 2);
  return RenderContinuous(
      metronome,
      kSampleRate * 2,
      OnceAtFrame(kRecallAt, [&](int64_t) { metronome.StartAt(kRecallFrame); })
  );
}

// TestStartAtIgnoredWhileRunning drains the second StartAt in the same block,
// before any click sounds. This one arrives blocks later, after clicks have
// emitted: it too is dropped, so no sounded beat moves and none re-fires — the
// deferred-start call's "future targets only" and "no double beat".
void TestStartAtRecallWhileRunningIgnored() {
  const auto base = RunStartAtRecall(false);
  const auto recalled = RunStartAtRecall(true);
  Check(
      !base.empty() && base.size() == recalled.size(),
      "start_at re-call while running: onset count unchanged"
  );
  double max_dev = 0.0;
  const size_t count = std::min(base.size(), recalled.size());
  for (size_t i = 0; i < count; ++i) {
    max_dev = std::max(
        max_dev,
        std::fabs(static_cast<double>(base[i] - recalled[i]))
    );
  }
  Check(
      max_dev <= 2.0,
      "start_at re-call while running: already-emitted clicks never move"
  );
}

// Stop cancels a pending StartAt: the click never begins.
void TestStopCancelsPendingStartAt() {
  kitbag::Metronome metronome;
  metronome.SetTempo(120.0);
  metronome.StartAt(kSampleRate / 2);
  metronome.Stop();
  const auto onsets = RenderAndDetectOnsets(metronome, kSampleRate * 2);
  Check(onsets.empty(), "stop cancels pending start_at: no clicks");
}

}  // namespace

void RunStartAtTests() {
  TestStartAt();
  TestStartAtAnchorAtZero();
  TestStartAtWithArmedRampRecomputesLocals();
  TestStartAtIgnoredWhileRunning();
  TestStartCancelsPendingStartAt();
  TestStartAtKeepsBeatZeroUnderLatencyOffset();
  TestStartAtRecallWhileRunningIgnored();
  TestStopCancelsPendingStartAt();
}

}  // namespace metronome_test
