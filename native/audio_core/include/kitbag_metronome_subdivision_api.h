#ifndef KITBAG_METRONOME_SUBDIVISION_API_H
#define KITBAG_METRONOME_SUBDIVISION_API_H

/* Each header includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Metronome: subdivision accents -------------------------------------- */

/* Accent pattern for one subdivision count.
 * Bit s of slot_mask accents tick s of every beat while `subdivision` (the
 * kb_metronome_set_subdivision count) is current; an accented tick plays the
 * accent sound's accented click. Bit 0, the on-beat tick, is ignored: beats
 * follow kb_metronome_set_accent only, and a muted beat silences its ticks.
 * Bits at or past the count never sound. Rows start empty and survive stop.
 * Ignored unless subdivision is in Metronome::kMinSubdivision..kMaxSubdivision
 * and 0 <= slot_mask < 2^kMaxSubdivision. */
KB_EXPORT void kb_metronome_set_subdivision_accents(
    kb_engine* engine,
    int32_t subdivision,
    int32_t slot_mask
);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_SUBDIVISION_API_H */
