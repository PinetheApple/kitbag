#ifndef KITBAG_ENGINE_CLOCK_API_H
#define KITBAG_ENGINE_CLOCK_API_H

/* Each of this and kitbag_api.h includes the other under its guard, so either
 * order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Engine: render clock ----------------------------------------------- */

/* Latest render callback's first engine frame and CLOCK_MONOTONIC at entry.
 * KB_ERROR_BUSY: no callback since create or any stop, or retries lost. */
KB_EXPORT kb_result kb_engine_clock_pair(
    const kb_engine* engine,
    int64_t* out_frame,
    int64_t* out_monotonic_ns
);

/* CLOCK_BOOTTIME (Android's SystemClock.elapsedRealtimeNanos) now; the
 * monotonic clock where the platform has no boottime clock. */
KB_EXPORT int64_t kb_clock_boottime_ns(void);

/* The engine frame the render callback was at when kb_clock_boottime_ns read
 * boottime_ns, from the latest clock pair, to the nearest frame; instants
 * either side of the pair extrapolate at the engine rate. Output latency is not
 * included: the latency offset covers it. May be negative.
 * KB_ERROR_INVALID_ARGUMENT for a null engine or output or a negative
 * boottime_ns; KB_ERROR_BUSY as kb_engine_clock_pair. */
KB_EXPORT kb_result kb_engine_frame_at_boottime(
    const kb_engine* engine,
    int64_t boottime_ns,
    int64_t* out_frame
);

#ifdef KITBAG_BUILD_TOOLS
/* Verify only: kb_engine_render with the clock pair stamped monotonic_ns
 * instead of the time of the call. */
KB_EXPORT void kb_engine_render_at(
    kb_engine* engine,
    float* out,
    uint32_t frame_count,
    int64_t monotonic_ns
);
#endif /* KITBAG_BUILD_TOOLS */

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_ENGINE_CLOCK_API_H */
