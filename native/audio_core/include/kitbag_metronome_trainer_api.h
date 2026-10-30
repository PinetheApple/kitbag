#ifndef KITBAG_METRONOME_TRAINER_API_H
#define KITBAG_METRONOME_TRAINER_API_H

/* The metronome's trainer controls and status reads, split from kitbag_api.h
 * for length. Each includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Metronome: trainers ------------------------------------------------- */

/* Bar-mute trainer: repeating cycle of `play_bars` sounding bars followed by
 * `mute_bars` silent bars (all voices), anchored at bar 0. */
KB_EXPORT void kb_metronome_set_bar_mute(
    kb_engine* engine,
    int32_t enabled,
    int32_t play_bars,
    int32_t mute_bars
);
/* 1 while the current bar is silenced by the bar-mute trainer. */
KB_EXPORT int32_t kb_metronome_bar_muted(const kb_engine* engine);
/* Bar index within the play+mute cycle (play_bars.. are muted); -1 when the
 * trainer is off, stopped or counting in. */
KB_EXPORT int32_t kb_metronome_bar_mute_position(const kb_engine* engine);
/* 0-based bar of the running count-in while counting in, else -1. */
KB_EXPORT int32_t kb_metronome_count_in_bar(const kb_engine* engine);
/* Bars in the running count-in, fixed when it started even if the count-in
 * setting changes mid-count; 0 when not counting in. */
KB_EXPORT int32_t kb_metronome_count_in_bars_total(const kb_engine* engine);
/* A kb_ramp_state. OFF when disabled, cancelled, stopped or under a grid;
 * AT_TARGET only for a non-looping ramp holding its target. */
KB_EXPORT int32_t kb_metronome_ramp_state(const kb_engine* engine);
/* BPM the next step lands on (start_bpm for a loop's restart); 0 unless
 * STEPPING. */
KB_EXPORT double kb_metronome_ramp_next_bpm(const kb_engine* engine);
/* Time to the next step in the ramp's unit, bars including the current one.
 * 0 unless STEPPING; also 0 while a time step waits for its beat. */
KB_EXPORT double kb_metronome_ramp_remaining(const kb_engine* engine);
/* Elapsed fraction of the current interval, [0, 1]; 1 at AT_TARGET, 0 when OFF. */
KB_EXPORT double kb_metronome_ramp_step_progress(const kb_engine* engine);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_METRONOME_TRAINER_API_H */
