#include "kitbag_api.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <vector>

#include "abi_test_engine_clock.h"
#include "abi_test_song_rig.h"
#include "check.h"
#include "metronome/metronome_internal.h"
#include "time_units.h"

namespace abi_test {
namespace {

using kitbag::metronome_detail::kAccentAmplitude;
using kitbag::metronome_detail::kBeatAmplitude;
using kitbag_test::Check;

constexpr double kSongBpm = 123.0;
constexpr double kBeatSec = kitbag::kSecondsPerMinute / kSongBpm;
constexpr int kBeatsPerBar = 4;
constexpr double kBarSec = kBeatSec * kBeatsPerBar;
constexpr double kGridTolerance = 4.0;
constexpr double kReportLag = 777.3;
constexpr double kLeadInSec = 0.1;
constexpr double kAccentLevel = (kAccentAmplitude + kBeatAmplitude) / 2.0;

// A song playing at speed 1: start_pos seconds in at engine frame start_frame.
struct SongLine {
  double start_frame;
  double start_pos;
  double rate;
  double PosAt(double frame) const {
    return start_pos + (frame - start_frame) / rate;
  }
  double FrameOfPos(double pos) const {
    return start_frame + (pos - start_pos) * rate;
  }
};

struct Beat {
  double frame;
  int64_t index;
};

// The song's beats (phase + n beats in) that fall on frames [from, to).
void AppendBeats(
    const SongLine& line,
    double phase,
    double from,
    double to,
    std::vector<Beat>* out
) {
  auto n =
      static_cast<int64_t>(std::floor((line.PosAt(from) - phase) / kBeatSec));
  for (;; ++n) {
    const double frame =
        line.FrameOfPos(phase + static_cast<double>(n) * kBeatSec);
    if (frame >= to) return;
    if (frame >= from) out->push_back({frame, n});
  }
}

bool OnsetsOnBeats(
    const std::vector<Onset>& onsets,
    const std::vector<Beat>& beats
) {
  for (size_t i = 0; i < onsets.size() && i < beats.size(); ++i) {
    if (std::fabs(static_cast<double>(onsets[i].frame) - beats[i].frame) >
        kGridTolerance) {
      std::fprintf(
          stderr,
          "  onset %zu at %lld, beat at %.1f\n",
          i,
          static_cast<long long>(onsets[i].frame),
          beats[i].frame
      );
      return false;
    }
  }
  if (onsets.size() != beats.size()) {
    std::fprintf(
        stderr,
        "  %zu onsets, %zu beats\n",
        onsets.size(),
        beats.size()
    );
  }
  return onsets.size() == beats.size();
}

kb_engine* PlayAlongEngine() {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  kb_metronome_select_slot(engine, KB_METRONOME_SLOT_PLAY_ALONG);
  kb_metronome_set_beats(
      engine,
      kBeatsPerBar,
      kitbag::Metronome::kBpmReferenceDenominator
  );
  return engine;
}

void RenderUntil(SongRig& rig, double frame) {
  while (static_cast<double>(rig.rendered) < frame) rig.Render(kRigBlock);
}

// The store's step: the other app reported its position at report_frame's
// instant; map that instant to an engine frame and anchor the click on it.
bool Reanchor(
    SongRig& rig,
    const SongLine& line,
    double report_frame,
    double offset_sec = 0.0
) {
  int64_t frame = 0;
  if (!rig.FrameAt(report_frame, &frame) || frame < 0) return false;
  kb_metronome_anchor_external(
      rig.engine,
      line.PosAt(report_frame) + offset_sec,
      static_cast<uint64_t>(frame),
      kSongBpm
  );
  return true;
}

struct LockRun {
  kb_engine* engine = PlayAlongEngine();
  SongRig rig{.engine = engine, .base_ns = kitbag::MonotonicNs()};
  std::vector<Beat> beats;
  bool mapped = true;

  LockRun() = default;
  LockRun(const LockRun&) = delete;
  LockRun& operator=(const LockRun&) = delete;
  ~LockRun() {
    kb_engine_destroy(engine);
  }

  double Rate() const {
    return kb_engine_sample_rate(engine);
  }
  double Now() const {
    return static_cast<double>(rig.rendered);
  }
  void Until(double seconds) {
    RenderUntil(rig, seconds * Rate());
  }
  void Anchor(const SongLine& line, double report_frame, double offset = 0.0) {
    mapped &= Reanchor(rig, line, report_frame, offset);
  }
  void Expect(const SongLine& line, double from, double phase = 0.0) {
    AppendBeats(line, phase, from, Now(), &beats);
  }
  bool Locked() const {
    return mapped && OnsetsOnBeats(rig.onsets, beats);
  }
};

void TestReanchorEveryFewSeconds() {
  LockRun run;
  if (run.engine == nullptr) return;
  const SongLine song{0.0, 31.37, run.Rate()};
  run.Until(kLeadInSec);
  const double first = run.Now();
  for (double at = first; at < 12.0 * run.Rate(); at += 1.5 * run.Rate()) {
    RenderUntil(run.rig, at);
    run.Anchor(song, run.Now() - kReportLag);
  }
  run.Until(13.0);
  run.Expect(song, first);
  Check(
      run.Locked(),
      "external lock: re-anchoring every 1.5 s keeps each click on the song's "
      "beat, none doubled, dropped or shifted"
  );
}

void TestSeekBack() {
  LockRun run;
  if (run.engine == nullptr) return;
  const SongLine before{0.0, 40.0, run.Rate()};
  run.Until(kLeadInSec);
  const double first = run.Now();
  run.Anchor(before, first - kReportLag);
  run.Until(3.1);
  run.Expect(before, first);
  const double seek_block = run.Now();
  const SongLine after{seek_block - kReportLag, 12.71, run.Rate()};
  run.Anchor(after, after.start_frame);
  run.Until(6.0);
  run.Expect(after, seek_block);
  Check(
      run.Locked(),
      "external lock: after a seek back the next click lands on the song's new "
      "beat grid within a block"
  );
}

void TestPauseThenResume() {
  LockRun run;
  if (run.engine == nullptr) return;
  const SongLine playing{0.0, 5.2, run.Rate()};
  run.Until(kLeadInSec);
  const double first = run.Now();
  run.Anchor(playing, first - kReportLag);
  run.Until(2.3);
  run.Expect(playing, first);
  const double pause_block = run.Now();
  kb_metronome_pause(run.engine);
  run.Until(4.3);
  const double resume_block = run.Now();
  const SongLine resumed{
      resume_block - kReportLag,
      playing.PosAt(pause_block),
      run.Rate()
  };
  run.Anchor(resumed, resumed.start_frame);
  run.Until(7.3);
  run.Expect(resumed, resume_block);
  Check(
      run.Locked(),
      "external lock: silent while paused, back on the beat after a resume "
      "re-anchor"
  );
}

bool AccentsFollowTap(
    const std::vector<Onset>& onsets,
    const std::vector<Beat>& beats,
    int64_t tap_beat
) {
  for (size_t i = 0; i < onsets.size() && i < beats.size(); ++i) {
    const int64_t in_bar =
        ((beats[i].index - tap_beat) % kBeatsPerBar + kBeatsPerBar) %
        kBeatsPerBar;
    if ((onsets[i].peak > kAccentLevel) != (in_bar == 0)) return false;
  }
  return !onsets.empty();
}

void TestTappedDownbeatIsBeatOne() {
  constexpr double kSongPhase = 0.137;
  constexpr int64_t kTapBeat = 6;
  constexpr double kBarsBack = 4.0;
  LockRun run;
  if (run.engine == nullptr) return;
  const SongLine song{0.0, 1.0, run.Rate()};
  const double tap_pos = kSongPhase + static_cast<double>(kTapBeat) * kBeatSec;
  run.Until(kLeadInSec);
  const double first = run.Now();
  run.Anchor(song, first - kReportLag, kBarsBack * kBarSec - tap_pos);
  run.Until(5.0);
  run.Expect(song, first, kSongPhase);
  Check(
      run.Locked() && AccentsFollowTap(run.rig.onsets, run.beats, kTapBeat),
      "external lock: a song-relative anchor makes the tapped beat the bar's "
      "accented beat 1"
  );
}

}  // namespace

void RunExternalLockAbiTests() {
  TestReanchorEveryFewSeconds();
  TestSeekBack();
  TestPauseThenResume();
  TestTappedDownbeatIsBeatOne();
}

}  // namespace abi_test
