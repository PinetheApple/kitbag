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

/* --- Metronome ---------------------------------------------------------- */

typedef enum kb_accent {
  KB_ACCENT_MUTED = 0,
  KB_ACCENT_NORMAL = 1,
  KB_ACCENT_ACCENTED = 2,
} kb_accent;

KB_EXPORT void kb_metronome_start(kb_engine* engine);
KB_EXPORT void kb_metronome_stop(kb_engine* engine);
KB_EXPORT void kb_metronome_set_tempo(kb_engine* engine, double bpm);
KB_EXPORT void kb_metronome_set_beats(kb_engine* engine, int32_t beats_per_bar);
KB_EXPORT void kb_metronome_set_subdivision(kb_engine* engine,
                                            int32_t subdivision);
KB_EXPORT void kb_metronome_set_accent(kb_engine* engine, int32_t beat_index,
                                       int32_t accent);
KB_EXPORT void kb_metronome_set_poly(kb_engine* engine, int32_t enabled,
                                     int32_t beats);
KB_EXPORT void kb_metronome_set_sound(kb_engine* engine, int32_t sound_index);
KB_EXPORT int32_t kb_metronome_is_running(const kb_engine* engine);
/* Beat index within the bar, -1 when stopped. Poll for UI. */
KB_EXPORT int32_t kb_metronome_current_beat(const kb_engine* engine);
KB_EXPORT int32_t kb_metronome_current_poly_beat(const kb_engine* engine);
/* Position within the bar, [0, 1). For beat-sweep UI. */
KB_EXPORT double kb_metronome_bar_phase(const kb_engine* engine);

/* --- Tuner -------------------------------------------------------------- */

/* Opens the mic (raw/unprocessed where the backend allows) and starts
 * pitch analysis. */
KB_EXPORT kb_result kb_tuner_start(kb_engine* engine);
KB_EXPORT void kb_tuner_stop(kb_engine* engine);
KB_EXPORT int32_t kb_tuner_is_running(const kb_engine* engine);
/* Reference pitch, clamped to 415-466 Hz. */
KB_EXPORT void kb_tuner_set_a4(kb_engine* engine, double a4_hz);
/* Constrains detection to [low_hz, high_hz] — the preset/per-string band
 * that kills octave errors. */
KB_EXPORT void kb_tuner_set_band(kb_engine* engine, double low_hz,
                                 double high_hz);
/* Latest smoothed pitch in Hz, 0 when nothing is sounding. Poll for UI. */
KB_EXPORT double kb_tuner_pitch_hz(const kb_engine* engine);
/* Offset from the nearest chromatic note, in cents. */
KB_EXPORT double kb_tuner_cents(const kb_engine* engine);
/* Detection confidence [0, 1]. */
KB_EXPORT double kb_tuner_confidence(const kb_engine* engine);
/* MIDI note number of the nearest note, -1 when no pitch. */
KB_EXPORT int32_t kb_tuner_note_index(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_API_H */
