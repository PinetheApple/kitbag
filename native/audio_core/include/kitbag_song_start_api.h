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

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_SONG_START_API_H */
