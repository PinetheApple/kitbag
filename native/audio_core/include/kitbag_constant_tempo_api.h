#ifndef KITBAG_CONSTANT_TEMPO_API_H
#define KITBAG_CONSTANT_TEMPO_API_H

/* Each header includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Constant tempo: one bpm for a stored beat grid ---------------------- */

/* Inclusive bpm range kb_fit_constant_tempo accepts. */
#define KB_CONSTANT_TEMPO_MIN_BPM 30
#define KB_CONSTANT_TEMPO_MAX_BPM 300

/* Fits beat n = anchor + n * 60 / bpm to a beat grid such as kb_analyze_song
 * returns. Pure: it holds no engine and never touches the audio thread.
 *
 *   bpm_out: Theil-Sen over the beats, numbered by whole periods elapsed, so
 *            a skipped beat does not shift the later numbers; the same
 *            estimator as the bpm kb_analyze_song reports. Above 256 beats the
 *            slopes come from every ceil(beat_count / 256)-th beat.
 *   anchor_sec_out: the fitted time of the first bar line at or after the
 *            first beat. Bar lines fall on the modal beat number, modulo
 *            *beats_per_bar_out, of the downbeats; with no downbeats, on the
 *            first beat. A negative time moves forward by whole bars, so the
 *            anchor is always >= 0.
 *   beats_per_bar_out: the modal gap, in beat numbers, between consecutive
 *            downbeats, counting gaps of 2..16 only; ties go to the earlier
 *            gap. 4 when no gap counts.
 *
 * beat_times must be finite and strictly ascending, beat_count within
 * 2..KB_MAX_GRID_BEATS. downbeat_count lies within 0..beat_count and each
 * downbeat index within the beats; downbeat_indices may be NULL for none.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null output or beat pointer, a beat
 * or downbeat list that breaks these rules, or a fitted bpm outside
 * KB_CONSTANT_TEMPO_MIN_BPM..KB_CONSTANT_TEMPO_MAX_BPM; KB_ERROR_INTERNAL when
 * out of memory. On any error every output reads 0. */
KB_EXPORT kb_result kb_fit_constant_tempo(
    const float* beat_times,
    int32_t beat_count,
    const int32_t* downbeat_indices,
    int32_t downbeat_count,
    float* bpm_out,
    double* anchor_sec_out,
    int32_t* beats_per_bar_out
);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_CONSTANT_TEMPO_API_H */
