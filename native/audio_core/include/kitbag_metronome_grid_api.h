#ifndef KITBAG_METRONOME_GRID_API_H
#define KITBAG_METRONOME_GRID_API_H

/* Each header includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Metronome: beat grid and external anchor ---------------------------- */

/* Maximum beats a single grid may carry: 5.4 hours at the analyser's 200 BPM
 * ceiling, 9 hours at 120, so a long song's grid is not cut short. */
#define KB_MAX_GRID_BEATS 65536

/* Follow a measured beat grid instead of a single BPM, so a song whose tempo
 * drifts stays locked. beat_times_sec are seconds from the song's start and
 * must be strictly ascending and finite; they are copied during the call and
 * need not outlive it. Song second t falls on engine frame
 * anchor_frame + t * sample_rate.
 * Subdivisions divide each measured interval and still sound. The tempo ramp
 * and polyrhythm are defined against a constant BPM and do not apply while a
 * grid is set.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null, empty, non-ascending or
 * non-finite grid, or a count above KB_MAX_GRID_BEATS. */
KB_EXPORT kb_result kb_metronome_set_grid(
    kb_engine* engine,
    const double* beat_times_sec,
    int32_t count,
    uint64_t anchor_frame
);
/* Return to constant-tempo mode. The click keeps its phase: the first click at
 * the constant tempo falls one whole beat after the last grid beat that
 * sounded, not on the next sample. */
KB_EXPORT void kb_metronome_clear_grid(kb_engine* engine);
/* Anchor the click to an external transport this engine does not clock — a
 * Spotify or YouTube stream. Declares that at engine frame at_frame the song was
 * song_pos_sec into playback, running at a constant bpm, and lays the click grid
 * to match: the song's beat 0 is at song second 0, its beats every 60/bpm
 * seconds. Starts the click if it was stopped.
 * Re-callable at any time to re-anchor; a re-anchor moves only future clicks and
 * never double-clicks or drops a beat. A negative or fractional song_pos_sec is
 * a mid-bar anchor — the click stays silent until the song reaches beat 0, then
 * follows the beats. bpm is clamped to the metronome's range. The tempo ramp
 * does not apply while anchored; the latency offset still lands the click at the
 * speaker, not the buffer.
 * A measured grid set via kb_metronome_set_grid takes precedence: while a grid
 * is set this anchor is a no-op, taking effect only after kb_metronome_clear_grid.
 * at_frame crosses as a uint64_t but is exact to 2^53 frames — ~5,900 years at
 * 48kHz — so it may be passed as a JS double. No BigInt. */
KB_EXPORT void kb_metronome_anchor_external(
    kb_engine* engine,
    double song_pos_sec,
    uint64_t at_frame,
    double bpm
);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_GRID_API_H */
