#include <cmath>
#include <cstdint>
#include <limits>

#include "api/api_engine.h"
#include "kitbag_song_start_api.h"
#include "metronome/count_in_schedule.h"

using kitbag::ToEngine;

namespace {

static_assert(
    KB_MAX_EXACT_FRAME == uint64_t{1} << std::numeric_limits<double>::digits
);

bool ValidCountInAt(
    uint64_t end_frame,
    double beat_frames,
    int32_t beats_per_bar
) {
  return end_frame <= KB_MAX_EXACT_FRAME && std::isfinite(beat_frames) &&
         beat_frames >= kitbag::CountInSchedule::kMinBeatFrames &&
         beats_per_bar >= 1 && beats_per_bar <= kitbag::Metronome::kMaxBeats;
}

}  // namespace

extern "C" {

kb_result kb_mixer_play_at(kb_engine* engine, uint64_t start_frame) {
  if (engine == nullptr) return KB_ERROR_INVALID_ARGUMENT;
  kitbag::Engine* e = ToEngine(engine);
  if (!e->mixer().HasCommandRoom()) return KB_ERROR_BUSY;
  const bool had_intent = e->mixer_intent();
  e->SetMixerIntent(true);
  if (e->mixer().PlayAt(start_frame)) return KB_OK;
  e->SetMixerIntent(had_intent);
  return KB_ERROR_BUSY;
}

kb_result kb_metronome_count_in_at(
    kb_engine* engine,
    uint64_t end_frame,
    double beat_frames,
    int32_t beats_per_bar,
    int32_t start_click
) {
  return kb_metronome_slot_count_in_at(
      engine,
      kb_metronome_selected_slot(engine),
      end_frame,
      beat_frames,
      beats_per_bar,
      start_click
  );
}

kb_result kb_metronome_slot_count_in_at(
    kb_engine* engine,
    int32_t slot,
    uint64_t end_frame,
    double beat_frames,
    int32_t beats_per_bar,
    int32_t start_click
) {
  if (engine == nullptr || !kitbag::Engine::ValidMetronomeSlot(slot) ||
      !ValidCountInAt(end_frame, beat_frames, beats_per_bar)) {
    return KB_ERROR_INVALID_ARGUMENT;
  }
  kitbag::Engine* target = ToEngine(engine);
  kitbag::Metronome& metronome = target->metronome(slot);
  // A rollback could restore a token whose count already ended, which nothing
  // would ever clear; refusing before the claim needs none.
  if (!metronome.HasCommandRoom()) return KB_ERROR_BUSY;
  const uint32_t intent = target->ClaimMetronomeIntent(slot);
  const bool queued = metronome.CountInAt(
      end_frame,
      beat_frames,
      beats_per_bar,
      start_click != 0,
      intent
  );
  if (!queued) return KB_ERROR_BUSY;
  kitbag::StopRigClickFor(target, slot);
  return KB_OK;
}

}  // extern "C"
