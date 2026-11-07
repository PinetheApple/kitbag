#ifndef KITBAG_SONG_START_API_H
#define KITBAG_SONG_START_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Song start: count-in, then the song on one frame -------------------- */

/* kb_mixer_play on engine frame start_frame (cf. kb_engine_frames_rendered)
 * rather than when the call lands. A frame already past when the engine drains
 * the call starts at once. Until then the mixer reads not playing; a play
 * while playing goes silent, holding the head, until start_frame.
 * kb_mixer_play, kb_mixer_pause, kb_mixer_stop or another kb_mixer_play_at
 * replaces it; kb_mixer_seek does not, so seek first to start elsewhere.
 * Sets play intent like kb_mixer_play (kitbag_engine_hold_api.h).
 * Returns KB_ERROR_INVALID_ARGUMENT for a null engine and KB_ERROR_BUSY when
 * the command queue is full, which queues nothing. */
KB_EXPORT kb_result kb_mixer_play_at(kb_engine* engine, uint64_t start_frame);

/* Counts in on the engine clock, then starts the click as
 * kb_metronome_start_at(end_frame) would, with no bar count-in of its own.
 * Count beat k (k = 1 .. bars * beats_per_bar, bars from
 * kb_metronome_set_count_in) sounds on the engine frame nearest
 * end_frame - k * beat_frames; bar ones fall every beats_per_bar beats,
 * counted from the first. Sound and distinct come from
 * kb_metronome_set_count_in; with its bars off nothing counts. No latency
 * offset moves a count beat, as under kb_metronome_follow_mixer. A beat
 * already past when the engine drains the call is dropped, never played late.
 * A running click stops while the count plays, and kb_metronome_is_running
 * reads 0 until end_frame, as after kb_metronome_start_at; the count-in
 * mirrors report the count. A start, start_at, anchor, stop or pause cancels
 * it. Pair it with kb_mixer_play_at(end_frame) and a grid followed with
 * kb_metronome_follow_mixer(1): the song and its click start on end_frame.
 * Sets play intent like kb_metronome_start.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null engine, end_frame above 2^53,
 * beat_frames below 1 or not finite, or beats_per_bar outside
 * [1, Metronome::kMaxBeats]; KB_ERROR_BUSY when the command queue is full.
 * Either leaves everything unchanged. */
KB_EXPORT kb_result kb_metronome_count_in_at(
    kb_engine* engine,
    uint64_t end_frame,
    double beat_frames,
    int32_t beats_per_bar
);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_SONG_START_API_H */
