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
/* Tempo ramp trainer: step BPM once per bar from start to end over `bars`
 * bars, then hold. A manual kb_metronome_set_tempo cancels it. */
KB_EXPORT void kb_metronome_set_ramp(kb_engine* engine, int32_t enabled,
                                     double start_bpm, double end_bpm,
                                     int32_t bars);
/* Bar-mute trainer: repeating cycle of `play_bars` sounding bars followed by
 * `mute_bars` silent bars (all voices), anchored at bar 0. */
KB_EXPORT void kb_metronome_set_bar_mute(kb_engine* engine, int32_t enabled,
                                         int32_t play_bars,
                                         int32_t mute_bars);
KB_EXPORT int32_t kb_metronome_is_running(const kb_engine* engine);
/* Beat index within the bar, -1 when stopped. Poll for UI. */
KB_EXPORT int32_t kb_metronome_current_beat(const kb_engine* engine);
KB_EXPORT int32_t kb_metronome_current_poly_beat(const kb_engine* engine);
/* Position within the bar, [0, 1). For beat-sweep UI. */
KB_EXPORT double kb_metronome_bar_phase(const kb_engine* engine);
/* Effective BPM including ramp progress. Poll for UI. */
KB_EXPORT double kb_metronome_current_bpm(const kb_engine* engine);
/* 1 while the current bar is silenced by the bar-mute trainer. */
KB_EXPORT int32_t kb_metronome_bar_muted(const kb_engine* engine);

/* --- Tuner -------------------------------------------------------------- */

/* Opens the mic (raw/unprocessed where the backend allows) and starts
 * pitch analysis. */
KB_EXPORT kb_result kb_tuner_start(kb_engine* engine);
KB_EXPORT void kb_tuner_stop(kb_engine* engine);
/* Reference pitch, clamped to 415-466 Hz. */
KB_EXPORT void kb_tuner_set_a4(kb_engine* engine, double a4_hz);
/* Constrains detection to [low_hz, high_hz] — the preset/per-string band
 * that kills octave errors. */
KB_EXPORT void kb_tuner_set_band(kb_engine* engine, double low_hz,
                                 double high_hz);
/* The whole smoothed reading packed into one value — a single atomic read,
 * so a poll can never mix fields from two updates. Poll for UI.
 *   bits 0-15   int16   nearest-note MIDI index (-1 = no pitch)
 *   bits 16-31  int16   cents offset from that note, x100
 *   bits 32-47  uint16  confidence [0,1] x10000 */
KB_EXPORT uint64_t kb_tuner_snapshot(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_API_H */
