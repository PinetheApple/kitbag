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

/* The file's format; its rate is kb_engine_sample_rate. */
#define KB_MIXDOWN_CHANNELS 2
#define KB_MIXDOWN_BITS_PER_SAMPLE 16

/* Renders the whole song as the mixer holds it at the call (each loaded stem's
 * gain, mute, solo and key, master gain and speed; not the loop, head or
 * click) to out_path: stereo 16-bit PCM WAV at the engine rate. Takes a copy
 * of the mix and returns; loading, priming and rendering run on a background
 * thread, and live playback carries on. Output goes to out_path + ".part",
 * renamed on success; FAILED and CANCELLED leave neither file.
 * Returns KB_OK once the render runs; KB_ERROR_BUSY while one runs;
 * KB_ERROR_INVALID_ARGUMENT for a null engine or path or no stem loaded;
 * KB_ERROR_TOO_LONG past a WAV's 4 GiB data limit; KB_ERROR_NO_SPACE when the
 * destination volume cannot hold the file with room to spare. A stem that
 * will not open, or a failed write or rename, ends FAILED. */
KB_EXPORT kb_result kb_mixdown_start(kb_engine* engine, const char* out_path);
/* Returns at once; the state reads CANCELLED once the partial file is gone.
 * kb_engine_destroy cancels and waits. */
KB_EXPORT void kb_mixdown_cancel(kb_engine* engine);
/* [0, 1]; 1 once DONE. */
KB_EXPORT double kb_mixdown_progress(const kb_engine* engine);
/* A kb_mixdown_state. */
KB_EXPORT int32_t kb_mixdown_current_state(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_MIXDOWN_API_H */
