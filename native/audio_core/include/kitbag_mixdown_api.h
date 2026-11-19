#ifndef KITBAG_MIXDOWN_API_H
#define KITBAG_MIXDOWN_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Mixdown export (SPEC.md §7.7) -------------------------------------- */

typedef enum kb_mixdown_state {
  KB_MIXDOWN_STATE_IDLE = 0,
  KB_MIXDOWN_STATE_RUNNING = 1,
  KB_MIXDOWN_STATE_DONE = 2,
  KB_MIXDOWN_STATE_FAILED = 3,
  KB_MIXDOWN_STATE_CANCELLED = 4,
} kb_mixdown_state;

/* Renders the whole song as the mixer holds it at the call — every loaded
 * stem's gain, mute, solo and key, master gain and speed — to out_path as a
 * stereo 16-bit PCM WAV at the engine rate, on a background thread. The loop,
 * the head and the metronome are not in it. Live playback is untouched and may
 * carry on meanwhile.
 * The file is written to out_path + ".part" and renamed to out_path on success;
 * a failed or cancelled render leaves neither behind.
 * Returns KB_OK once the render runs (kb_mixdown_current_state reads RUNNING);
 * KB_ERROR_BUSY while another render runs; KB_ERROR_INVALID_ARGUMENT for a null
 * engine or path, no stem loaded, or a stem that will not open;
 * KB_ERROR_NO_SPACE when the destination volume cannot hold the file with
 * room to spare; KB_ERROR_INTERNAL when the file cannot be created or the
 * speed and key cannot be primed. On any error nothing is written and the
 * state reads as before. Loads and primes the stems on the calling thread. */
KB_EXPORT kb_result kb_mixdown_start(kb_engine* engine, const char* out_path);
/* Asks a running render to stop; the state reads CANCELLED once its partial
 * file is gone. Returns at once. A no-op when nothing runs. Destroying the
 * engine cancels and waits. */
KB_EXPORT void kb_mixdown_cancel(kb_engine* engine);
/* Fraction of the current or last render written, [0, 1]; 1 once DONE. */
KB_EXPORT double kb_mixdown_progress(const kb_engine* engine);
/* A kb_mixdown_state; IDLE for a null engine or before the first render. */
KB_EXPORT int32_t kb_mixdown_current_state(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_MIXDOWN_API_H */
