#include <algorithm>
#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#include "check.h"
#include "stem_sync_rate.h"

namespace stem_sync {
namespace {

using kitbag_test::Check;

// Well under the stretch latency this guards (over 60 ms); what is left is the
// vocoder's smear of a pulse's centre.
constexpr double kMaxLockMs = 1.5;
constexpr double kMaxDriftMs = 0.2;
constexpr double kMsPerSecond = 1000.0;
constexpr int64_t kSongWindowFrames = 9000;
constexpr int kTailBlocks = 2;

struct LockCase {
  double rate;
  int32_t semitones;
};
constexpr LockCase kCases[] = {{0.5, 0}, {0.75, 0}, {kUnity, 3}, {0.75, -2}};

double PulseCentre(const Take& take, int64_t around, int64_t half_width) {
  double weight = 0.0;
  double moment = 0.0;
  const auto size = static_cast<int64_t>(take.left.size());
  const int64_t from = std::max<int64_t>(around - half_width, 0);
  for (int64_t k = from; k < std::min(around + half_width, size); ++k) {
    const auto i = static_cast<size_t>(k);
    const double stem = take.left[i] - take.right[i];
    weight += stem * stem;
    moment += stem * stem * static_cast<double>(k);
  }
  return weight > 0.0 ? moment / weight : -1.0;
}

Take RenderSong(const std::string& stem, const LockCase& lock) {
  Take take;
  kb_engine* engine = OpenFollowingEngine(stem);
  if (engine == nullptr) return take;
  kb_mixer_set_rate(engine, static_cast<float>(lock.rate));
  if (lock.semitones != 0) {
    kb_mixer_set_track_pitch(engine, 0, lock.semitones);
  }
  kb_mixer_play(engine);
  const double out_frames = static_cast<double>(SongFrames()) / lock.rate;
  RenderPaced(
      engine,
      &take,
      static_cast<int>(out_frames / kBlock) - kTailBlocks
  );
  kb_engine_destroy(engine);
  return take;
}

// Pulses are centred on their beats, so the stem's centre of energy is where
// the song puts the beat, however the vocoder widens the pulse.
void TestClickLockedToStem(const std::string& stem, const LockCase& lock) {
  const Take take = RenderSong(stem, lock);
  const std::vector<int64_t> clicks = DetectClicks(take.right);
  const std::string name = "lock " + std::to_string(lock.rate) + "x " +
                           std::to_string(lock.semitones) + " st";
  const bool whole = clicks.size() == static_cast<size_t>(kBeatCount);
  Check(whole, (name + ": every beat clicks once").c_str());
  if (!whole) {
    std::fprintf(stderr, "  %zu clicks, want %d\n", clicks.size(), kBeatCount);
    return;
  }
  const auto half_width = static_cast<int64_t>(kSongWindowFrames / lock.rate);
  double worst = 0.0;
  std::vector<double> offsets;
  for (const int64_t click : clicks) {
    const double offset =
        PulseCentre(take, click, half_width) - static_cast<double>(click);
    offsets.push_back(offset / kRate * kMsPerSecond);
    worst = std::max(worst, std::fabs(offsets.back()));
  }
  const double drift = std::fabs(offsets.back() - offsets.front());
  Check(worst <= kMaxLockMs, (name + ": each click sits on its pulse").c_str());
  Check(drift <= kMaxDriftMs, (name + ": no drift across the song").c_str());
  if (worst > kMaxLockMs || drift > kMaxDriftMs) {
    std::fprintf(stderr, "  worst %.3f ms, drift %.3f ms\n", worst, drift);
  }
}

}  // namespace

void RunLockTests(const std::string& stem) {
  for (const LockCase& lock : kCases) TestClickLockedToStem(stem, lock);
}

}  // namespace stem_sync
