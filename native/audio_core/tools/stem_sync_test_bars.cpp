#include <algorithm>
#include <cmath>
#include <string>
#include <vector>

#include "check.h"
#include "click_take.h"
#include "downbeats.h"
#include "index_list.h"
#include "metronome/metronome_internal.h"
#include "mixer/transport_plan.h"
#include "stem_sync_rate.h"

namespace stem_sync {
namespace {

using kitbag::metronome_detail::kAccentAmplitude;
using kitbag::metronome_detail::kBeatAmplitude;
using kitbag_test::Check;
using kitbag_test::IndexList;

constexpr int kBarBeats = 13;
constexpr double kAccentFloor = (kAccentAmplitude + kBeatAmplitude) / 2.0;
constexpr float kSpeed = 0.75f;
constexpr float kRates[] = {kitbag::kUnityRate, kSpeed};

struct BarCase {
  const char* label;
  int32_t first_downbeat;
  int32_t beats_per_bar;
};
constexpr BarCase kCases[] = {
    {"3/4 song", 0, 3},
    {"4/4 song opening on a pickup", 1, 4},
};

std::vector<int32_t> Downbeats(const BarCase& c) {
  return kitbag_test::EveryNthBeat(
      c.first_downbeat,
      c.beats_per_bar,
      kBeatCount
  );
}

bool SetBarGrid(kb_engine* engine, const BarCase& c) {
  std::vector<double> seconds;
  for (double beat : Beats()) seconds.push_back(beat / kSampleRate);
  const std::vector<int32_t> downbeats = Downbeats(c);
  return kb_metronome_set_grid(
             engine,
             seconds.data(),
             static_cast<int32_t>(seconds.size()),
             downbeats.data(),
             static_cast<int32_t>(downbeats.size()),
             0
         ) == KB_OK;
}

kb_engine*
OpenBarEngine(const std::string& stem, const BarCase& c, float rate) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  if (kb_mixer_load_track(engine, 0, stem.c_str()) != KB_OK ||
      !SetBarGrid(engine, c) || kb_mixer_set_rate(engine, rate) != KB_OK) {
    kb_engine_destroy(engine);
    return nullptr;
  }
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  kb_mixer_play(engine);
  return engine;
}

std::vector<int> AccentedClicks(const Take& take) {
  const std::vector<int64_t> clicks = click_take::DetectClicks(take.right);
  std::vector<int> accented;
  for (size_t i = 0; i < clicks.size() && i < kBarBeats; ++i) {
    const auto from = static_cast<size_t>(clicks[i]);
    const auto to = std::min(from + click_take::kGapFrames, take.right.size());
    float peak = 0.0f;
    for (size_t k = from; k < to; ++k) {
      peak = std::max(peak, std::fabs(take.right[k]));
    }
    if (peak > kAccentFloor) accented.push_back(static_cast<int>(i));
  }
  return accented;
}

void ExpectSongAccents(const std::string& stem, const BarCase& c, float rate) {
  kb_engine* engine = OpenBarEngine(stem, c, rate);
  if (engine == nullptr) return;
  Take take;
  const double until = Beats()[kBarBeats] / rate;
  RenderPaced(engine, &take, static_cast<int>(until / kBlock));
  kb_engine_destroy(engine);
  std::vector<int> want;
  for (int32_t b : Downbeats(c)) {
    if (b < kBarBeats) want.push_back(b);
  }
  const std::string label = std::string("bars: ") + c.label + " at " +
                            std::to_string(rate).substr(0, 4) + "x";
  Check(
      click_take::DetectClicks(take.right).size() >= kBarBeats,
      (label + ", every beat clicks").c_str()
  );
  const std::vector<int> got = AccentedClicks(take);
  Check(got == want, (label + ", accents on the song's downbeats").c_str());
  if (got != want) {
    std::fprintf(
        stderr,
        "  accented %s, expected %s\n",
        IndexList(got).c_str(),
        IndexList(want).c_str()
    );
  }
}

}  // namespace

void RunBarTests(const std::string& stem) {
  for (const BarCase& c : kCases) {
    for (float rate : kRates) ExpectSongAccents(stem, c, rate);
  }
}

}  // namespace stem_sync
