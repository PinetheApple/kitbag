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

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_ENGINE_CLOCK_API_H */
