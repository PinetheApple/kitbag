#ifndef KITBAG_CLICK_SOUND_API_H
#define KITBAG_CLICK_SOUND_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Custom click sounds (SPEC.md §5.3) ---------------------------------- */

/* Offline, on the calling thread; needs no engine. Decodes in_path (any format
 * song import takes) in one streamed pass to mono at 48 kHz, keeps the first
 * through the last sample at or above -60 dBFS, fades the last 5 ms out,
 * scales the result so its peak is full scale (the built-in sounds' peak) and
 * writes it to out_path as a mono 32-bit float WAV, via out_path + ".part"
 * renamed on success.
 * Returns KB_OK once written; KB_ERROR_INVALID_ARGUMENT for a null path, a
 * file that will not decode or stops decoding before its stated length, or a
 * non-finite sample; KB_ERROR_TOO_LONG when the kept span is longer than 2 s;
 * KB_ERROR_SILENT when no sample reaches the threshold; KB_ERROR_NO_SPACE when
 * the volume fills during the write; KB_ERROR_INTERNAL when the write or
 * rename fails otherwise. An error leaves out_path as it was and no ".part"
 * behind. Holds at most 2 s of audio in memory, whatever the input's length. */
KB_EXPORT kb_result
kb_click_sound_prepare(const char* in_path, const char* out_path);

/* Loads a file kb_click_sound_prepare wrote into custom slot `slot` (0 or 1),
 * resampled to the engine rate, and publishes it for the audio callback; a
 * replaced sound is freed off the audio callback. Returns KB_OK once
 * published; KB_ERROR_INVALID_ARGUMENT for a null engine or path, a slot out
 * of range or a file that will not decode, which keep the slot as it was;
 * KB_ERROR_TOO_LONG for a file longer than 2 s.
 *
 * Load and clear are not serialized: they must not overlap each other, or
 * kb_engine_start, kb_engine_stop or a hold call on another thread, since
 * those share the retire lists a start or stop reclaims. */
KB_EXPORT kb_result kb_metronome_load_custom_sound(
    kb_engine* engine,
    int32_t slot,
    const char* path
);
/* Empties the slot; a no-op for a null engine or a slot out of range. */
KB_EXPORT void kb_metronome_clear_custom_sound(kb_engine* engine, int32_t slot);
/* 1 while the slot holds a sound, else 0. */
KB_EXPORT int32_t
kb_metronome_custom_sound_loaded(const kb_engine* engine, int32_t slot);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_CLICK_SOUND_API_H */
