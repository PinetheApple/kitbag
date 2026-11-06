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

constexpr double kThreeQuarters = 0.75;
constexpr double kHalf = 0.5;
constexpr int kBlocksPerSegment = 700;
constexpr double kSegments[] = {kUnity, kThreeQuarters, kHalf, kUnity};
// Both ends of an interval round up to a whole output frame.
constexpr double kIntervalSlackFrames = 1.0;
constexpr int kTailBlocks = 40;

struct Walk {
  size_t segment = 0;
  bool ok = true;
};

bool Near(double got, double want) {
  return std::fabs(got - want) <= kIntervalSlackFrames;
}

// Each interval runs wholly at one rate or straddles one change, between the
// two rates' spacings: a jumped beat runs short, a doubled one reads as zero.
void WalkInterval(Walk* walk, double song_gap, double out_gap, size_t beat) {
  const double here = song_gap / kSegments[walk->segment];
  if (Near(out_gap, here)) return;
  const bool can_step = walk->segment + 1 < std::size(kSegments);
  const double there =
      can_step ? song_gap / kSegments[walk->segment + 1] : here;
  if (can_step && Near(out_gap, there)) {
    ++walk->segment;
    return;
  }
  const double low = std::min(here, there) - kIntervalSlackFrames;
  const double high = std::max(here, there) + kIntervalSlackFrames;
  if (can_step && out_gap >= low && out_gap <= high) {
    ++walk->segment;
    return;
  }
  walk->ok = false;
  std::fprintf(
      stderr,
      "  interval after beat %zu: %.0f frames, segment %zu expects %.1f\n",
      beat,
      out_gap,
      walk->segment,
      here
  );
}

void TestRateChangesMidPlay(const std::string& stem) {
  kb_engine* engine = OpenFollowingEngine(stem);
  if (engine == nullptr) return;
  Take take;
  kb_mixer_play(engine);
  RenderPaced(engine, &take, kBlocksPerSegment);
  kb_mixer_set_rate(engine, static_cast<float>(kThreeQuarters));
  RenderPaced(engine, &take, kBlocksPerSegment);
  kb_mixer_set_rate(engine, static_cast<float>(kHalf));
  RenderPaced(engine, &take, kBlocksPerSegment);
  kb_mixer_set_rate(engine, static_cast<float>(kUnity));
  RenderPaced(engine, &take, kBlocksPerSegment + kTailBlocks);
  kb_engine_destroy(engine);

  const std::vector<int64_t> clicks = DetectClicks(take.right);
  const std::vector<double> beats = Beats();
  Walk walk;
  for (size_t i = 0; i + 1 < clicks.size(); ++i) {
    const double out_gap = static_cast<double>(clicks[i + 1] - clicks[i]);
    WalkInterval(&walk, beats[i + 1] - beats[i], out_gap, i);
  }
  Check(
      clicks.size() >= 2 && walk.ok,
      "re-anchor: every interval runs at one rate or straddles one change"
  );
  Check(
      walk.segment + 1 == std::size(kSegments),
      "re-anchor: the song crosses all three changes"
  );
}

}  // namespace

void RunReanchorTests(const std::string& stem) {
  TestRateChangesMidPlay(stem);
}

}  // namespace stem_sync
