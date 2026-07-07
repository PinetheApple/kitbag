#ifndef KITBAG_API_H
#define KITBAG_API_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#if defined(_WIN32)
#define KB_EXPORT __declspec(dllexport)
#else
#define KB_EXPORT __attribute__((visibility("default")))
#endif

typedef enum kb_result {
  KB_OK = 0,
  KB_ERROR_INVALID_ARGUMENT = 1,
  KB_ERROR_DEVICE_INIT_FAILED = 2,
  KB_ERROR_DEVICE_START_FAILED = 3,
} kb_result;

typedef struct kb_engine kb_engine;

KB_EXPORT const char* kb_version(void);

KB_EXPORT kb_result kb_engine_create(kb_engine** out_engine);
KB_EXPORT void kb_engine_destroy(kb_engine* engine);

KB_EXPORT kb_result kb_engine_start(kb_engine* engine);
KB_EXPORT void kb_engine_stop(kb_engine* engine);

KB_EXPORT uint32_t kb_engine_sample_rate(const kb_engine* engine);

/* Monotonic frames rendered since start; the master clock. */
KB_EXPORT uint64_t kb_engine_frames_rendered(const kb_engine* engine);

KB_EXPORT void kb_engine_set_test_tone(kb_engine* engine,
                                       int32_t enabled,
                                       float frequency_hz);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_API_H */
