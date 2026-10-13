#ifndef KITBAG_TUNER_API_H
#define KITBAG_TUNER_API_H

/* The tuner's string-aware tuning mode, split from kitbag_api.h for length.
 * Each includes the other under its guard, so either order works. */
#include "kitbag_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* --- Tuner: string-aware tuning mode ------------------------------------- */
/* Reports against open strings (docs/tuner-functional-spec.md §2) from the
 * mic kb_tuner_start opens, or kb_tuner_offline_* in verify builds. Analysis
 * frames are 4096 samples, one every 2048 at 48 kHz (spec P1/P2).
 *
 * Threads: every kb_tuner_* call except kb_tuner_read_state and
 * kb_tuner_snapshot must come from one app thread; those two may be polled
 * from any thread. While the mic runs, setters are queued to the analysis
 * thread and applied before its next block. kb_tuner_stop joins that thread
 * before it returns, and only then does the app thread own analysis again.
 *
 * The queue holds 32 setter calls. A setter made while it is full changes
 * nothing and returns KB_ERROR_BUSY; the caller retries. With the mic off a
 * setter applies at once and cannot be busy. */

#define KB_TUNER_MAX_STRINGS 12
#define KB_TUNER_AUTO_STRING (-1) /* target: pick the nearest string */
#define KB_TUNER_NO_STRING (-1)
#define KB_TUNER_NO_NOTE (-1) /* target_midi when no note is held */
/* in_tune_ratio at or above this marks the current string as tuned. */
#define KB_TUNER_TUNED_RATIO 0.95

/* Selects the in-tune window table (spec P12-P15). */
typedef enum kb_tuner_instrument {
  KB_TUNER_INSTRUMENT_GUITAR = 0,
  KB_TUNER_INSTRUMENT_BASS = 1,
  KB_TUNER_INSTRUMENT_UKULELE = 2,
  KB_TUNER_INSTRUMENT_OTHER = 3,
} kb_tuner_instrument;

typedef enum kb_tuning_status {
  KB_TUNING_NOT_MEASURED = 0,
  KB_TUNING_TOO_LOW = 1,
  KB_TUNING_IN_TUNE = 2,
  KB_TUNING_TOO_HIGH = 3,
} kb_tuning_status;

/* Side of the manual target the heard (wrong) string lies on. */
typedef enum kb_wrong_string {
  KB_WRONG_STRING_NONE = 0,
  KB_WRONG_STRING_BELOW = 1,
  KB_WRONG_STRING_ABOVE = 2,
} kb_wrong_string;

/* One reading; every field comes from the same analysis hop. Strings are
 * indices into the tuning, low string first. */
typedef struct kb_tuner_state {
  uint32_t measurement_id; /* +1 per hop, never reused; frozen while paused */
  int32_t can_hear_note;   /* 1 while a note is held, including the release */
  int32_t current_string;  /* or KB_TUNER_NO_STRING, always so in chromatic */
  /* Manual: the heard string per P20-P23. Auto: a string taking over. */
  int32_t possible_wrong_string;
  int32_t wrong_string_direction; /* kb_wrong_string */
  int32_t tuning_status;          /* kb_tuning_status */
  int32_t listening_paused;       /* 1 during a reset's pause */
  int32_t no_sound_issue;         /* 1 once nothing is heard for 20 s */
  int32_t target_midi;            /* error's reference, or KB_TUNER_NO_NOTE */
  double measured_hz;             /* 0 with no note */
  double measured_midi;           /* fractional; 0 with no note */
  double tuning_error_cents;      /* 1200*log2(measured / target) */
  double in_tune_threshold_cents; /* half-width of the in-tune window */
  double in_tune_ratio; /* [0, 1]: in-window time; leaving resets it */
  double mic_rms;       /* recent maximum, linear full scale */
} kb_tuner_state;

/* Install open strings as MIDI notes in string order, low string first;
 * copied. Selects auto mode, clears note history. Returns
 * KB_ERROR_INVALID_ARGUMENT, keeping the old tuning, for a null engine/list,
 * count outside [1, KB_TUNER_MAX_STRINGS], note outside [0, 127], bad enum;
 * KB_ERROR_BUSY, likewise keeping it, when the setter queue is full. */
KB_EXPORT kb_result kb_tuner_set_tuning(
    kb_engine* engine,
    int32_t instrument,
    const int32_t* string_midis,
    int32_t count
);
/* Manual mode on a string index, or auto for KB_TUNER_AUTO_STRING; clears
 * smoothing. KB_ERROR_INVALID_ARGUMENT for an index outside the tuning;
 * KB_ERROR_BUSY as above. */
KB_EXPORT kb_result
kb_tuner_set_target_string(kb_engine* engine, int32_t string_index);
/* Chromatic mode: target the nearest semitone and report no string, until
 * kb_tuner_set_target_string or kb_tuner_set_tuning. */
KB_EXPORT kb_result kb_tuner_set_chromatic(kb_engine* engine);
/* Clear note history (SPEC.md §10.2 reset on re-entry); then, for
 * pause_ms > 0, suspend measurement that long, rounded to whole hops. A
 * pause requested before kb_tuner_start runs from its first hop. */
KB_EXPORT kb_result
kb_tuner_reset_note_presence(kb_engine* engine, double pause_ms);
/* Latest reading into *out; a null engine yields the rest state. */
KB_EXPORT void
kb_tuner_read_state(const kb_engine* engine, kb_tuner_state* out);

#ifdef KITBAG_BUILD_TOOLS
/* Verify-only, like kb_engine_render: PCM never crosses the shipped ABI.
 * Restart analysis at sample_rate with all input-derived state cleared;
 * tuning, target and A4 are kept. KB_ERROR_INVALID_ARGUMENT for a null
 * engine, a zero rate, or while kb_tuner_start's mic is live. */
KB_EXPORT kb_result
kb_tuner_offline_init(kb_engine* engine, uint32_t sample_rate);
/* Analyse mono samples synchronously; on return the state reflects every
 * hop the input completed. A no-op before kb_tuner_offline_init. */
KB_EXPORT void kb_tuner_offline_process(
    kb_engine* engine,
    const float* samples,
    uint32_t frame_count
);
#endif /* KITBAG_BUILD_TOOLS */

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_TUNER_API_H */
