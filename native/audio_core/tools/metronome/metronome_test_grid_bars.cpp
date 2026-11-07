// Under a song grid the click's bars are the song's (#300): accents, bar mute,
// subdivision mute and the mirrors, whatever the standalone meter and row.
#include <cmath>
#include <iterator>
#include <string>

#include "index_list.h"
#include "metronome_test_audio.h"
#include "song_bars.h"

namespace metronome_test {
namespace {

using kitbag_test::IndexList;

// Uneven, so no constant tempo can pass for the grid.
constexpr double kBarBeatsSec[] =
    {0.1, 0.57, 1.09, 1.55, 2.08, 2.61, 3.07, 3.6, 4.12, 4.58, 5.11, 5.63, 6.1};
constexpr int kBarBeatCount = static_cast<int>(std::size(kBarBeatsSec));
constexpr double kRenderTailSec = 0.5;
constexpr double kMirrorTolerance = 1e-6;
constexpr double kMidBeat = 0.5;

struct BarCase {
  const char* label;
  int standalone_beats;
  std::vector<int32_t> downbeats;
};

std::unique_ptr<kitbag::BeatGrid> BarGrid(
    const std::vector<int32_t>& downbeats
) {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec.assign(std::begin(kBarBeatsSec), std::end(kBarBeatsSec));
  grid->bars = kitbag::GridBars(downbeats, grid->beat_times_sec.size());
  return grid;
}

struct GridTake {
  std::vector<int> accented;
  std::vector<int> sounded;
};

GridTake TakeGrid(kitbag::Metronome& metronome) {
  const std::vector<float> left = RenderLeft(
      metronome,
      FramesFor(kBarBeatsSec[kBarBeatCount - 1] + kRenderTailSec)
  );
  GridTake take;
  for (int i = 0; i < kBarBeatCount; ++i) {
    const int64_t onset = FramesFor(kBarBeatsSec[i]);
    if (PeakIn(left, onset) < kSilentCeiling) continue;
    take.sounded.push_back(i);
    if (PitchIs(left, onset, kBeepAccentHz)) take.accented.push_back(i);
  }
  return take;
}

void StartOnBars(
    kitbag::Metronome& metronome,
    int standalone_beats,
    const std::vector<int32_t>& downbeats
) {
  metronome.SetSounds(kBeepSound, kBeepSound);
  metronome.SetTimeSignature(standalone_beats, 4);
  metronome.SetGrid(BarGrid(downbeats), 0, true);
  metronome.Start();
}

void ExpectIndices(
    const std::vector<int>& got,
    const std::vector<int>& want,
    const std::string& label
) {
  const std::string detail =
      "got " + IndexList(got) + ", expected " + IndexList(want);
  CheckCase(got == want, label, detail.c_str());
}

std::vector<int> AllBeats() {
  std::vector<int> all;
  for (int i = 0; i < kBarBeatCount; ++i) all.push_back(i);
  return all;
}

void ExpectSongAccents(const BarCase& c) {
  kitbag::Metronome metronome;
  StartOnBars(metronome, c.standalone_beats, c.downbeats);
  const GridTake take = TakeGrid(metronome);
  const std::string label = std::string("grid bars: ") + c.label;
  ExpectIndices(take.sounded, AllBeats(), label + ", every beat sounds");
  ExpectIndices(
      take.accented,
      std::vector<int>(c.downbeats.begin(), c.downbeats.end()),
      label + ", accents"
  );
}

void TestAccentsFollowSongBars() {
  const BarCase cases[] = {
      {"3/4 song, metronome 4/4", 4, {0, 3, 6, 9, 12}},
      {"3/4 song, metronome 5/4", 5, {0, 3, 6, 9, 12}},
      {"4/4 song opening on a pickup, metronome 4/4", 4, {1, 5, 9}},
      {"no downbeats, metronome 4/4", 4, {}},
  };
  for (const BarCase& c : cases) ExpectSongAccents(c);
}

void TestStandaloneRowIsIgnored() {
  kitbag::Metronome metronome;
  metronome.SetAccent(0, kitbag::Accent::kNormal);
  metronome.SetAccent(1, kitbag::Accent::kMuted);
  metronome.SetAccent(2, kitbag::Accent::kAccented);
  StartOnBars(metronome, 4, {1, 5, 9});
  const GridTake take = TakeGrid(metronome);
  ExpectIndices(
      take.sounded,
      AllBeats(),
      "grid bars: a standalone muted beat still sounds"
  );
  ExpectIndices(
      take.accented,
      {1, 5, 9},
      "grid bars: standalone accents do not move the song's"
  );
}

void TestBarMuteCountsSongBars() {
  kitbag::Metronome metronome;
  metronome.SetBarMute(true, 1, 1);
  StartOnBars(metronome, 4, {1, 5, 9});
  ExpectIndices(
      TakeGrid(metronome).sounded,
      {0, 1, 2, 3, 4, 9, 10, 11, 12},
      "grid bars: bar mute silences the song's second bar, not the pickup"
  );
}

struct MirrorCase {
  const char* label;
  std::vector<int32_t> downbeats;
  int beat;
  int position;
  int length;
};

void ExpectMirrors(const MirrorCase& c) {
  kitbag::Metronome metronome;
  StartOnBars(metronome, 4, c.downbeats);
  const double from = kBarBeatsSec[c.beat];
  const double interval = kBarBeatsSec[c.beat + 1] - from;
  const int64_t end = FramesFor(from + interval * kMidBeat);
  RenderLeft(metronome, end);
  const int64_t rendered =
      (end + kBlockFrames - 1) / kBlockFrames * kBlockFrames;
  const double last_sec = static_cast<double>(rendered - 1) / kSampleRate;
  const double phase = (c.position + (last_sec - from) / interval) / c.length;
  const std::string label = std::string("grid bars: ") + c.label;
  CheckCase(
      metronome.current_beat() == c.position,
      label + ", current_beat",
      std::to_string(metronome.current_beat()).c_str()
  );
  CheckCase(
      std::fabs(metronome.bar_phase() - phase) < kMirrorTolerance,
      label + ", bar_phase",
      std::to_string(metronome.bar_phase()).c_str()
  );
}

void TestMirrorsFollowSongBars() {
  const MirrorCase cases[] = {
      {"3/4 song under 4/4, beat 4", {0, 3, 6, 9, 12}, 4, 1, 3},
      {"pickup beat of a 4/4 song", {1, 5, 9}, 0, 3, 4},
      {"no downbeats", {}, 6, 0, 1},
  };
  for (const MirrorCase& c : cases) ExpectMirrors(c);
}

// A click definitely sounding, not merely brushing the onset floor: 4x
// kOnsetThreshold, so a live subdivision clears it but a decay tail cannot.
constexpr double kGridSoundingPeak = 0.2;

// #24 (a #21 follow-up): a grid subdivision belongs to the interval it divides,
// the left-endpoint beat. A measured 0.15 s grid (bpm 400) offset into the
// future so beats 0 and 1 both sound cleanly under the offset; one-beat song
// bars put beat 1 alone in muted bar 1. At +100 ms the latency spans 2/3 of a
// beat, so an owning beat off by one would sound a muted bar's subdivision.
double GridMuteCascadePeak(bool bar_mute, int64_t lo, int64_t hi) {
  kitbag::Metronome metronome;
  metronome.SetTimeSignature(4, 4);
  metronome.SetSubdivision(2);
  metronome.SetLatencyOffset(100.0);
  metronome.SetBarMute(bar_mute, 1, 1);
  auto grid = MakeShiftedGrid(8, 0.2, 0.15);
  SetSongBars(grid.get(), 0, 1);
  metronome.SetGrid(std::move(grid), 0, true);
  metronome.Start();
  return WindowedPeak(metronome, lo, hi);
}

// Beat 1's subdivision fires near frame 15600; muting its bar must silence it
// on the speaker-time base, while beat 0's subdivision (near 8400) sounds.
void TestGridMutedBarCascadesToSubdivision() {
  const double leaked = GridMuteCascadePeak(true, 15200, 16200);
  Check(
      leaked < kOnsetThreshold,
      "grid mute cascade: muting beat 1's bar silences its own subdivision "
      "under +100 ms"
  );
  const double sounding = GridMuteCascadePeak(false, 15200, 16200);
  Check(
      sounding > kGridSoundingPeak,
      "grid mute cascade: beat 1's subdivision sounds when its bar is not muted"
  );
  const double beat_zero_sub = GridMuteCascadePeak(true, 8000, 9000);
  Check(
      beat_zero_sub > kGridSoundingPeak,
      "grid mute cascade: muting beat 1's bar leaves beat 0's subdivision "
      "sounding"
  );
}

}  // namespace

void RunGridBarTests() {
  TestAccentsFollowSongBars();
  TestStandaloneRowIsIgnored();
  TestBarMuteCountsSongBars();
  TestMirrorsFollowSongBars();
  TestGridMutedBarCascadesToSubdivision();
}

}  // namespace metronome_test
