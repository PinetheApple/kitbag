#ifndef KITBAG_METRONOME_POLY_API_H
#define KITBAG_METRONOME_POLY_API_H

/* The metronome's polyrhythm row. Each header includes the other under its
 * guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Metronome: polyrhythm ----------------------------------------------- */

/* kb_metronome_set_poly_against's default: the cycle spans the bar and follows
 * every later kb_metronome_set_beats. */
#define KB_POLY_AGAINST_BAR 0

/* kb_metronome_poly_downbeat_phase when there is no poly cycle to place. */
#define KB_POLY_PHASE_NONE (-1.0)

/* Poly beats per cycle, clamped to Metronome::kMinPolyBeats..kMaxPolyBeats. */
KB_EXPORT void
kb_metronome_set_poly(kb_engine* engine, int32_t enabled, int32_t beats);
/* Independent of the main row; slot 0 defaults accented. Slots past the poly
 * count are ignored; growing it resets new slots to normal. */
KB_EXPORT void kb_metronome_set_poly_accent(
    kb_engine* engine,
    int32_t beat_index,
    int32_t accent
);
/* Cycles span main_beats beats from beat 0 (song beat 0 if anchored). Only
 * KB_POLY_AGAINST_BAR follows meter changes, not an equal explicit value. */
KB_EXPORT void
kb_metronome_set_poly_against(kb_engine* engine, int32_t main_beats);
/* Poly beat index within its cycle; -1 when stopped, poly disabled or a beat
 * grid is set, and after a poly count change until the next poly beat. */
KB_EXPORT int32_t kb_metronome_current_poly_beat(const kb_engine* engine);
/* Fraction of the poly cycle already elapsed at the current bar's downbeat,
 * [0, 1); KB_POLY_PHASE_NONE when stopped, poly off, gridded or before beat 0. */
KB_EXPORT double kb_metronome_poly_downbeat_phase(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_POLY_API_H */
