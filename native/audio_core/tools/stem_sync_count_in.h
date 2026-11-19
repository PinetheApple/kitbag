#ifndef KITBAG_TOOLS_STEM_SYNC_COUNT_IN_H
#define KITBAG_TOOLS_STEM_SYNC_COUNT_IN_H

#include "kitbag_api.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

#include "metronome/metronome_internal.h"
#include "mixer/transport_plan.h"
#include "stem_sync_rate.h"

namespace stem_sync::count_in {

constexpr int32_t kBarBeats = 3;
constexpr int32_t kCountInBars = 2;
constexpr int kCountBeats = kCountInBars * kBarBeats;
// A downbeat 0.9 frames past a whole frame: the head snaps back onto the whole
// frame, so the bar's first click sounds after the end frame, not on it.
constexpr size_t kStartBeat = 7;
constexpr int64_t kSafetyFrames = 4800;
constexpr int kSettleBlocks = 30;
constexpr double kHalfFrame = 0.5;
constexpr int64_t kNotFound = -1;
constexpr int32_t kClickOn = 1;
constexpr int32_t kClickOff = 0;

struct Start {
  double rate = kitbag::kUnityRate;
  int64_t head = 0;
  double beat_frames = 0.0;
  int64_t end = 0;
};

kb_engine* OpenEngine(const std::string& stem, double rate);
// The caller's side of a counted start: the head on the bar's whole frame, the
// count at the beat before it, slowed with the song.
Start PlanStart(kb_engine* engine, double rate);
bool CountIn(kb_engine* engine, const Start& start, int32_t start_click);
// A beat sounds on the first output frame whose song position reaches it.
int64_t HeardFrame(int64_t out, int64_t head, double rate, double beat);
size_t FirstBeatAfter(int64_t head);
std::vector<int64_t> CountClicks(const Start& start);
void RenderUntil(kb_engine* engine, Take* take, int64_t frame);
int64_t FirstStem(const Take& take);

}  // namespace stem_sync::count_in

namespace stem_sync {

void RunSilentCountInTests(const std::string& ramp);

}  // namespace stem_sync

#endif  // KITBAG_TOOLS_STEM_SYNC_COUNT_IN_H
