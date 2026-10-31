#ifndef KITBAG_METRONOME_POLY_API_H
#define KITBAG_METRONOME_POLY_API_H

/* The metronome's polyrhythm row, split from kitbag_api.h for length. Each
 * includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Metronome: polyrhythm ----------------------------------------------- */

/* kb_metronome_set_poly_against's default: the cycle spans the bar and follows
 * every later kb_metronome_set_beats. */
#define KB_POLY_AGAINST_BAR 0

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
/* The N:M ratio's M: one poly cycle spans main_beats main beats, or the bar
 * for KB_POLY_AGAINST_BAR. Cycles start on the run's first downbeat and every
 * main_beats beats after it, running across barlines when main_beats does not
 * divide the bar; they keep that phase through tempo, ramp and meter changes.
 * An explicit main_beats does not follow kb_metronome_set_beats. Values
 * outside Metronome::kMinPolyAgainst..kMaxPolyAgainst, other than
 * KB_POLY_AGAINST_BAR, are ignored. */
KB_EXPORT void
kb_metronome_set_poly_against(kb_engine* engine, int32_t main_beats);
/* Poly beat index within its cycle; -1 when stopped, poly disabled or a beat
 * grid is set, and after a poly count change until the next poly beat. */
KB_EXPORT int32_t kb_metronome_current_poly_beat(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_POLY_API_H */
