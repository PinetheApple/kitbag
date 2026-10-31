#ifndef KITBAG_RIG_CLICK_API_H
#define KITBAG_RIG_CLICK_API_H

/* Each header includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Rig click: Settings' test click ------------------------------------- */

/* A click independent of the metronome's pattern, tempo and transport.
 * Tick k (k = beat * subdivision + slot) sounds on engine frame
 * start_frame + ceil(k * 60 * sample_rate / (bpm * subdivision)), on the
 * kb_engine_frames_rendered clock; a quotient within 1e-6 of a whole frame
 * counts as whole. Slot 0 plays the normal sound's beat click; other slots
 * play the subdivision voice, or the accent sound's accented click where
 * kb_metronome_set_subdivision_accents marks the slot for `subdivision`.
 * Volume is kb_metronome_set_volume's. The latency offset moves no tick, as on
 * a metronome started with kb_metronome_start_at.
 * A start_frame already past when the engine drains the call keeps its
 * schedule: ticks before that block are skipped, never played late.
 * Restarting replaces the schedule. Counts as play intent (kitbag_engine_hold_api.h)
 * and, like kb_metronome_start, never starts the device.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null engine, a non-finite bpm or one
 * outside the metronome's tempo range, a subdivision outside
 * Metronome::kMinSubdivision..kMaxSubdivision or a negative start_frame, and
 * KB_ERROR_BUSY while the metronome is started or its queue is full; either
 * leaves everything unchanged. Starting the metronome stops the rig click.
 * After a metronome stop, BUSY lasts until that stop has been rendered. */
KB_EXPORT kb_result kb_rig_click_start(
    kb_engine* engine,
    double bpm,
    int32_t subdivision,
    int64_t start_frame
);
/* No tick sounds from the next rendered block; a click already sounding decays.
 * Clears the rig click's play intent. Never lost to a full queue. */
KB_EXPORT void kb_rig_click_stop(kb_engine* engine);
/* 1 while the rig click is running, as of the last rendered block. */
KB_EXPORT int32_t kb_rig_click_is_active(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_RIG_CLICK_API_H */
