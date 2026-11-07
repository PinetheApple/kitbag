// Accents under a song grid follow the song's bars (#300), whatever the
// standalone metronome's meter.
#include <iterator>
#include <string>

#include "index_list.h"
#include "metronome_test_audio.h"

namespace metronome_test {
namespace {

using kitbag_test::IndexList;

// Uneven, so no constant tempo can pass for the grid.
constexpr double kBarBeatsSec[] =
    {0.1, 0.57, 1.09, 1.55, 2.08, 2.61, 3.07, 3.6, 4.12, 4.58, 5.11, 5.63, 6.1};
constexpr int kBarBeatCount = static_cast<int>(std::size(kBarBeatsSec));
constexpr double kRenderTailSec = 0.5;

struct BarCase {
  const char* label;
  int standalone_beats;
  std::vector<int32_t> downbeats;
};

std::unique_ptr<kitbag::BeatGrid> BarGrid() {
  auto grid = std::make_unique<kitbag::BeatGrid>();
  grid->beat_times_sec.assign(std::begin(kBarBeatsSec), std::end(kBarBeatsSec));
  return grid;
}

struct GridTake {
  std::vector<int> accented;
  int sounded = 0;
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
    ++take.sounded;
    if (PitchIs(left, onset, kBeepAccentHz)) take.accented.push_back(i);
  }
  return take;
}

void ExpectSongAccents(const BarCase& c) {
  kitbag::Metronome metronome;
  metronome.SetSounds(kBeepSound, kBeepSound);
  metronome.SetTimeSignature(c.standalone_beats, 4);
  metronome.SetGrid(BarGrid(), 0, true);
  metronome.Start();
  const GridTake take = TakeGrid(metronome);
  const std::vector<int> want(c.downbeats.begin(), c.downbeats.end());
  const std::string label = std::string("grid bars: ") + c.label;
  CheckCase(
      take.sounded == kBarBeatCount,
      label + ", every beat sounds",
      std::to_string(take.sounded).c_str()
  );
  const std::string detail =
      "accented " + IndexList(take.accented) + ", expected " + IndexList(want);
  CheckCase(take.accented == want, label + ", accents", detail.c_str());
}

void TestAccentsFollowSongBars() {
  const BarCase cases[] = {
      {"3/4 song, metronome 4/4", 4, {0, 3, 6, 9, 12}},
      {"3/4 song, metronome 5/4", 5, {0, 3, 6, 9, 12}},
      {"4/4 song opening on a pickup, metronome 4/4", 4, {1, 5, 9}},
  };
  for (const BarCase& c : cases) ExpectSongAccents(c);
}

}  // namespace

void RunGridBarTests() {
  TestAccentsFollowSongBars();
}

}  // namespace metronome_test
