#ifndef KITBAG_MIXER_RATE_API_H
#define KITBAG_MIXER_RATE_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Mixer: speed and key ----------------------------------------------- */

/* Playback speed in [0.5, 1.0], pitch held (SPEC.md §7.6). Position, seek, loop
 * points and a following metronome stay in song frames at any speed (§4.2.2).
 * Returns KB_ERROR_INVALID_ARGUMENT for a null engine or a rate outside the
 * range, NaN included, and KB_ERROR_BUSY when the command queue is full; either
 * way nothing changes. Primes the stretch on the calling thread when one is not
 * running yet, so a dragged control should debounce. */
KB_EXPORT kb_result kb_mixer_set_rate(kb_engine* engine, float rate);
/* 1.0 until set, 0.0 for a null engine. Follows set_rate within one block. */
KB_EXPORT float kb_mixer_rate(const kb_engine* engine);
/* A loaded track's key in whole semitones [-6, 6]: absolute, not an offset from
 * any song-wide control (SPEC.md §7.6). Returns KB_ERROR_INVALID_ARGUMENT for a
 * null engine, a value outside the range or a track with no stem loaded, and
 * KB_ERROR_BUSY when the command queue is full; either way nothing changes.
 * Primes on the calling thread like kb_mixer_set_rate. */
KB_EXPORT kb_result
kb_mixer_set_track_pitch(kb_engine* engine, int32_t track, int32_t semitones);
/* Follows set_track_pitch within one block; 0 for a null engine, a track outside
 * the valid range or a track never given a key. */
KB_EXPORT int32_t kb_mixer_track_pitch(const kb_engine* engine, int32_t track);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_MIXER_RATE_API_H */
