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
 * downbeat_indices are the song's bar-ones, indices into beat_times_sec,
 * strictly ascending; NULL with downbeat_count 0 means the song has none. Each
 * bar runs to the next downbeat and the last bar's length repeats; a lone
 * downbeat's bar runs to the grid's end. Under a grid, the downbeat of each bar
 * is accented and every other beat is normal, or grouped by
 * kb_metronome_set_grid_grouping, whatever kb_metronome_set_beats
 * and kb_metronome_set_accent hold; beats before the first downbeat, and every
 * beat of a grid without downbeats, are normal and outside any bar, so bar mute
 * never silences them. current_beat and bar_phase count the song's bars; with
 * no downbeats current_beat reads 0 and bar_phase sweeps each beat.
 * Subdivisions divide each measured interval and still sound. The tempo ramp
 * and polyrhythm are defined against a constant BPM and do not apply while a
 * grid is set.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null, empty, non-ascending or
 * non-finite grid, a count above KB_MAX_GRID_BEATS, or downbeats that are
 * NULL with a positive count, a negative count, out of range or not strictly
 * ascending. */
KB_EXPORT kb_result kb_metronome_set_grid(
    kb_engine* engine,
    const double* beat_times_sec,
    int32_t count,
    const int32_t* downbeat_indices,
    int32_t downbeat_count,
    uint64_t anchor_frame
);
/* Replace the downbeats of the grid set by kb_metronome_set_grid, keeping its
 * beats, its anchor_frame and the kb_metronome_anchor_grid mapping: the click
 * plays on without a re-seek, every beat sounds once, and from the next beat
 * the accent follows the new downbeats. downbeat_indices are as in set_grid;
 * NULL with downbeat_count 0 leaves the grid without downbeats, so no beat is
 * accented. The grid's grouping and rate still apply. Returns
 * KB_ERROR_INVALID_ARGUMENT, changing nothing, with no grid set on the selected
 * slot or for downbeats set_grid would refuse. */
KB_EXPORT kb_result kb_metronome_set_grid_downbeats(
    kb_engine* engine,
    const int32_t* downbeat_indices,
    int32_t downbeat_count
);
/* Return to constant-tempo mode. The click keeps its phase: the first click at
 * the constant tempo falls one whole beat after the last grid beat that
 * sounded, not on the next sample. */
KB_EXPORT void kb_metronome_clear_grid(kb_engine* engine);

#define KB_MAX_GRID_GROUPS 8

/* Click rate relative to the grid's beats. */
typedef enum kb_grid_rate {
  KB_GRID_RATE_SINGLE = 0,
  KB_GRID_RATE_DOUBLE = 1,
  KB_GRID_RATE_HALF = 2,
} kb_grid_rate;

/* Accent a grid's bars in groups, such as 3+2+2 for a 7-beat bar. While a bar's
 * length equals the sum of sizes, the first beat of each later group plays the
 * accent sound's accented subdivision click, quieter than the bar's downbeat;
 * any other bar keeps only its downbeat accent. count 0 clears the grouping
 * (sizes may then be NULL). Takes effect from the next beat.
 * kb_metronome_set_grid and kb_metronome_clear_grid reset the grouping to none
 * and the rate to KB_GRID_RATE_SINGLE: send both again after each set_grid.
 * A count-in sounds plain whatever the grouping and rate.
 * Returns KB_ERROR_INVALID_ARGUMENT for a negative count or one above
 * KB_MAX_GRID_GROUPS, NULL sizes with a positive count, a size below 1, or
 * sizes summing above Metronome::kMaxBeats; KB_ERROR_BUSY when the command
 * ring is full. Either way nothing changes. */
KB_EXPORT kb_result kb_metronome_set_grid_grouping(
    kb_engine* engine,
    const int32_t* sizes,
    int32_t count
);
/* Click rate under a grid. KB_GRID_RATE_DOUBLE adds a normal click halfway
 * between each pair of grid beats, following the grid's own spacing, and
 * subdivisions divide each half. KB_GRID_RATE_HALF sounds every other beat,
 * counted from each group's first beat under a grouping and from each downbeat
 * otherwise, so every downbeat and group start sounds; a grid without
 * downbeats counts from its first beat. Subdivisions divide the span from one
 * click to the next. Reset by set_grid and clear_grid as above.
 * Returns KB_ERROR_INVALID_ARGUMENT for a rate outside kb_grid_rate and
 * KB_ERROR_BUSY when the command ring is full. */
KB_EXPORT kb_result kb_metronome_set_grid_rate(kb_engine* engine, int32_t rate);
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
 * is set this anchor is a no-op, taking effect only after kb_metronome_clear_grid;
 * kb_metronome_anchor_grid re-anchors a grid.
 * at_frame is exact up to KB_MAX_EXACT_FRAME. */
KB_EXPORT void kb_metronome_anchor_external(
    kb_engine* engine,
    double song_pos_sec,
    uint64_t at_frame,
    double bpm
);
/* Anchor the grid set by kb_metronome_set_grid to an external transport without
 * moving it. Declares that at engine frame at_frame the song was song_pos_sec
 * into playback, in song seconds like the grid, and that it advances rate song
 * seconds per engine second: grid beat t sounds at engine frame
 * at_frame + (t - song_pos_sec) * sample_rate / rate, moved earlier by the
 * latency offset. Starts the click on the grid if it was stopped.
 * Set the grid once per lock and re-anchor with this call. A correction under
 * half a click interval never sounds a beat twice and never drops one: a beat
 * it skips over sounds at once, late. A larger move forward is a seek and drops
 * the beats it skips; a move back of at least one grid interval replays the
 * beats from the new position; any other move back sounds no beat again.
 * set_grid resets the mapping to song second 0 at its anchor_frame, rate 1. The
 * anchor applies to the grid set last on the selected slot: one made before
 * that set_grid, with no grid set, or while following the mixer is dropped,
 * as is one with a non-finite song_pos_sec or a rate that is not finite and
 * positive. at_frame is exact up to KB_MAX_EXACT_FRAME. */
KB_EXPORT void kb_metronome_anchor_grid(
    kb_engine* engine,
    double song_pos_sec,
    uint64_t at_frame,
    double rate
);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_GRID_API_H */
