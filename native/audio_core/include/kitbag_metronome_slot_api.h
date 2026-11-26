#ifndef KITBAG_METRONOME_SLOT_API_H
#define KITBAG_METRONOME_SLOT_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Metronome: slots --------------------------------------------------- */

/* One metronome per slot, each with its own settings, custom sounds, grid and
 * run state. Every other kb_metronome_* call and metronome read, the rig click
 * included, addresses the selected slot: STANDALONE until another is selected. */
typedef enum kb_metronome_slot {
  KB_METRONOME_SLOT_STANDALONE = 0,
  KB_METRONOME_SLOT_PLAY_ALONG = 1,
} kb_metronome_slot;

/* Only the selected slot sounds, from the next block. A deselected slot is
 * suspended: it keeps its settings and run state, applies the calls addressed
 * to it, lets a click already sounding ring out, and holds its beat position,
 * so a running slot resumes mid-beat where it left off when reselected. A grid
 * or a pending anchor follows the engine frame on resume. Never starts the
 * device: reselecting a running slot needs kb_engine_start after it. An
 * out-of-range slot is ignored. */
KB_EXPORT void kb_metronome_select_slot(kb_engine* engine, int32_t slot);
KB_EXPORT int32_t kb_metronome_selected_slot(const kb_engine* engine);

/* kb_metronome_start_at, _stop, _pause, _set_tempo and _current_bpm on one
 * slot whatever is selected, for a surface bound to that slot (the lock-screen
 * card drives STANDALONE). Out-of-range slots are ignored; their bpm reads 0.
 * A suspended slot's bpm reads its constant tempo. */
KB_EXPORT void kb_metronome_slot_start_at(
    kb_engine* engine,
    int32_t slot,
    uint64_t start_frame
);
KB_EXPORT void kb_metronome_slot_stop(kb_engine* engine, int32_t slot);
KB_EXPORT void kb_metronome_slot_pause(kb_engine* engine, int32_t slot);
KB_EXPORT void
kb_metronome_slot_set_tempo(kb_engine* engine, int32_t slot, double bpm);
KB_EXPORT double
kb_metronome_slot_current_bpm(const kb_engine* engine, int32_t slot);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_SLOT_API_H */
