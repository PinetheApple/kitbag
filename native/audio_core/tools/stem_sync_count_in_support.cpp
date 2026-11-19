#include <algorithm>
#include <cmath>

#include "downbeats.h"
#include "stem_sync_count_in.h"

namespace stem_sync::count_in {
namespace {

constexpr int32_t kFirstDownbeat = 1;
constexpr int32_t kWoodblock = 1;
// The end frame's index in its block: a start applied at the block's first
// frame comes this early.
constexpr int64_t kEndLead = 211;
constexpr double kFireSlackFrames =
    kitbag::metronome_detail::kGridEpsilon * kSampleRate;

}  // namespace

kb_engine* OpenEngine(const std::string& stem, double rate) {
  kb_engine* engine = nullptr;
  if (kb_engine_create(&engine) != KB_OK) return nullptr;
  std::vector<double> seconds;
  for (double beat : Beats()) seconds.push_back(beat / kSampleRate);
  const std::vector<int32_t> downbeats =
      kitbag_test::EveryNthBeat(kFirstDownbeat, kBarBeats, kBeatCount);
  if (kb_mixer_load_track(engine, 0, stem.c_str()) != KB_OK ||
      kb_metronome_set_grid(
          engine,
          seconds.data(),
          static_cast<int32_t>(seconds.size()),
          downbeats.data(),
          static_cast<int32_t>(downbeats.size()),
          0
      ) != KB_OK ||
      kb_mixer_set_rate(engine, static_cast<float>(rate)) != KB_OK) {
    kb_engine_destroy(engine);
    return nullptr;
  }
  kb_metronome_set_count_in(engine, kCountInBars, 1, kWoodblock);
  kb_metronome_follow_mixer(engine, 1);
  kb_metronome_start(engine);
  return engine;
}

Start PlanStart(kb_engine* engine, double rate) {
  const std::vector<double> beats = Beats();
  Start start{
      .rate = rate,
      .head = static_cast<int64_t>(std::floor(beats[kStartBeat])),
      .beat_frames = (beats[kStartBeat] - beats[kStartBeat - 1]) / rate
  };
  const int64_t earliest =
      static_cast<int64_t>(kb_engine_frames_rendered(engine)) + kSafetyFrames +
      std::llround(kCountBeats * start.beat_frames);
  start.end = earliest + (kEndLead + kBlock - earliest % kBlock) % kBlock;
  return start;
}

bool CountIn(kb_engine* engine, const Start& start, int32_t start_click) {
  kb_mixer_seek(engine, start.head);
  const auto end = static_cast<uint64_t>(start.end);
  return kb_metronome_count_in_at(
             engine,
             end,
             start.beat_frames,
             kBarBeats,
             start_click
         ) == KB_OK &&
         kb_mixer_play_at(engine, end) == KB_OK;
}

int64_t GridClick(int64_t out, int64_t head, double rate, double beat) {
  const double song_frames =
      beat - static_cast<double>(head) - kFireSlackFrames;
  return out +
         static_cast<int64_t>(std::ceil(std::max(0.0, song_frames) / rate));
}

size_t FirstBeatAfter(int64_t head) {
  const std::vector<double> beats = Beats();
  size_t i = 0;
  while (i < beats.size() && beats[i] <= static_cast<double>(head)) ++i;
  return i;
}

// From the song's own beats, not the caller's spacing: the count is heard at
// the slowed song's tempo.
std::vector<int64_t> CountClicks(const Start& start) {
  const std::vector<double> beats = Beats();
  const double heard = (beats[kStartBeat] - beats[kStartBeat - 1]) / start.rate;
  std::vector<int64_t> clicks;
  for (int k = kCountBeats; k >= 1; --k) {
    clicks.push_back(std::llround(start.end - k * heard));
  }
  return clicks;
}

void RenderUntil(kb_engine* engine, Take* take, int64_t frame) {
  while (static_cast<int64_t>(take->right.size()) <= frame) {
    RenderPaced(engine, take, 1);
  }
}

int64_t FirstStem(const Take& take) {
  for (size_t k = 0; k < take.left.size(); ++k) {
    if (std::fabs(take.left[k] - take.right[k]) > kHalfFrame) {
      return static_cast<int64_t>(k);
    }
  }
  return kNotFound;
}

}  // namespace stem_sync::count_in
