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

/* --- Metronome ---------------------------------------------------------- */

typedef enum kb_accent {
  KB_ACCENT_MUTED = 0,
  KB_ACCENT_NORMAL = 1,
  KB_ACCENT_ACCENTED = 2,
} kb_accent;

KB_EXPORT void kb_metronome_start(kb_engine* engine);
/* Sample-accurate start: the click begins on engine frame start_frame
 * (cf. kb_engine_frames_rendered), not when this call arrives. A frame already
 * past when drained starts on the next sample. Only takes effect while stopped.
 * start_frame crosses as a uint64_t but is exact to 2^53 frames — ~5,900 years
 * at 48kHz — so it may be passed as a JS double. No BigInt. */
KB_EXPORT void kb_metronome_start_at(kb_engine* engine, uint64_t start_frame);
KB_EXPORT void kb_metronome_stop(kb_engine* engine);

/* Maximum beats a single grid may carry. */
#define KB_MAX_GRID_BEATS 8192

/* Follow a measured beat grid instead of a single BPM, so a song whose tempo
 * drifts stays locked. beat_times_sec are seconds from the song's start and
 * must be strictly ascending and finite; they are copied during the call and
 * need not outlive it. Song second t falls on engine frame
 * anchor_frame + t * sample_rate.
 * Subdivisions divide each measured interval and still sound. The tempo ramp
 * and polyrhythm are defined against a constant BPM and do not apply while a
 * grid is set.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null, empty, non-ascending or
 * non-finite grid, or a count above KB_MAX_GRID_BEATS. */
KB_EXPORT kb_result kb_metronome_set_grid(
    kb_engine* engine,
    const double* beat_times_sec,
    int32_t count,
    uint64_t anchor_frame
);
/* Return to constant-tempo mode. The click keeps its phase: the first click at
 * the constant tempo falls one whole beat after the last grid beat that
 * sounded, not on the next sample. */
KB_EXPORT void kb_metronome_clear_grid(kb_engine* engine);
/* Anchor the click to an external transport this engine does not clock — a
 * Spotify or YouTube stream. Declares that at engine frame at_frame the song was
 * song_pos_sec into playback, running at a constant bpm, and lays the click grid
 * to match: the song's beat 0 is at song second 0, its beats every 60/bpm
 * seconds. Starts the click if it was stopped.
 * Re-callable at any time to re-anchor; a re-anchor moves only future clicks and
 * never double-clicks or drops a beat. A negative or fractional song_pos_sec is
 * a mid-bar anchor — the click stays silent until the song reaches beat 0, then
 * follows the beats. bpm is clamped to the metronome's range. The tempo ramp
 * does not apply while anchored; the latency offset still lands the click at the
 * speaker, not the buffer.
 * A measured grid set via kb_metronome_set_grid takes precedence: while a grid
 * is set this anchor is a no-op, taking effect only after kb_metronome_clear_grid.
 * at_frame crosses as a uint64_t but is exact to 2^53 frames — ~5,900 years at
 * 48kHz — so it may be passed as a JS double. No BigInt. */
KB_EXPORT void kb_metronome_anchor_external(
    kb_engine* engine,
    double song_pos_sec,
    uint64_t at_frame,
    double bpm
);
KB_EXPORT void kb_metronome_set_tempo(kb_engine* engine, double bpm);
KB_EXPORT void kb_metronome_set_beats(kb_engine* engine, int32_t beats_per_bar);
KB_EXPORT void
kb_metronome_set_subdivision(kb_engine* engine, int32_t subdivision);
KB_EXPORT void
kb_metronome_set_accent(kb_engine* engine, int32_t beat_index, int32_t accent);
KB_EXPORT void
kb_metronome_set_poly(kb_engine* engine, int32_t enabled, int32_t beats);
KB_EXPORT void kb_metronome_set_sound(kb_engine* engine, int32_t sound_index);
/* Volume multiplier [0, 2], default 1. */
KB_EXPORT void kb_metronome_set_volume(kb_engine* engine, double volume);
/* Output latency offset in ms [-100, 100]; positive = trigger earlier. */
KB_EXPORT void
kb_metronome_set_latency_offset(kb_engine* engine, double latency_ms);
/* Tempo ramp trainer: step BPM once per bar from start to end over `bars`
 * bars, then hold. A manual kb_metronome_set_tempo cancels it. */
KB_EXPORT void kb_metronome_set_ramp(
    kb_engine* engine,
    int32_t enabled,
    double start_bpm,
    double end_bpm,
    int32_t bars
);
/* Bar-mute trainer: repeating cycle of `play_bars` sounding bars followed by
 * `mute_bars` silent bars (all voices), anchored at bar 0. */
KB_EXPORT void kb_metronome_set_bar_mute(
    kb_engine* engine,
    int32_t enabled,
    int32_t play_bars,
    int32_t mute_bars
);
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
KB_EXPORT void
kb_tuner_set_band(kb_engine* engine, double low_hz, double high_hz);
/* The whole smoothed reading packed into one value — a single atomic read,
 * so a poll can never mix fields from two updates. Poll for UI.
 *   bits 0-15   int16   nearest-note MIDI index (-1 = no pitch)
 *   bits 16-31  int16   cents offset from that note, x100
 *   bits 32-47  uint16  confidence [0,1] x10000 */
KB_EXPORT uint64_t kb_tuner_snapshot(const kb_engine* engine);

/* --- Audio Decoder ------------------------------------------------------- */

/* Opens an audio file and reads metadata. Returns KB_OK on success. */
KB_EXPORT kb_result kb_decoder_open(kb_engine* engine, const char* path);
KB_EXPORT void kb_decoder_close(kb_engine* engine);
/* Duration in seconds. */
KB_EXPORT double kb_decoder_duration(const kb_engine* engine);
/* Sample rate in Hz. */
KB_EXPORT uint32_t kb_decoder_sample_rate(const kb_engine* engine);
/* Number of channels. */
KB_EXPORT uint32_t kb_decoder_channels(const kb_engine* engine);

/* --- Mixer (Stem Player) ------------------------------------------------ */

/* Load a track from a file path, streamed from disk (SPEC.md §4.1). The core
 * decodes and resamples to the engine rate off the audio callback, then
 * publishes the source by an atomic pointer swap, so a load during playback
 * cannot tear a read. No PCM crosses the boundary — every mixer boundary value
 * is now a scalar or a path, which is what §13.2 relies on.
 * Returns KB_ERROR_INVALID_ARGUMENT for a null engine or path, a track outside
 * the valid range, or a file that will not open; KB_OK once published. */
KB_EXPORT kb_result
kb_mixer_load_track(kb_engine* engine, int32_t track, const char* path);
/* Retire a track's source. RT-safe: the old source is reclaimed off the audio
 * callback, never freed on it. A no-op for a null engine or an empty track. */
KB_EXPORT void kb_mixer_unload_track(kb_engine* engine, int32_t track);
/* Non-blocking readiness poll: 1 once a source is live for the track, else 0.
 * Poll after a load to know when the track will sound. */
KB_EXPORT int32_t kb_mixer_track_ready(const kb_engine* engine, int32_t track);
KB_EXPORT void kb_mixer_set_gain(kb_engine* engine, int32_t track, float gain);
KB_EXPORT float kb_mixer_gain(const kb_engine* engine, int32_t track);
KB_EXPORT void
kb_mixer_set_mute(kb_engine* engine, int32_t track, int32_t muted);
KB_EXPORT int32_t kb_mixer_muted(const kb_engine* engine, int32_t track);
KB_EXPORT void
kb_mixer_set_solo(kb_engine* engine, int32_t track, int32_t soloed);
KB_EXPORT int32_t kb_mixer_soloed(const kb_engine* engine, int32_t track);
KB_EXPORT void kb_mixer_play(kb_engine* engine);
/* Ends playback and rewinds the head to frame 0. */
KB_EXPORT void kb_mixer_stop(kb_engine* engine);
/* Ends playback holding the head, so kb_mixer_play resumes from there. */
KB_EXPORT void kb_mixer_pause(kb_engine* engine);
KB_EXPORT int32_t kb_mixer_is_playing(const kb_engine* engine);
KB_EXPORT void kb_mixer_seek(kb_engine* engine, int64_t frame);
KB_EXPORT int64_t kb_mixer_position(const kb_engine* engine);
KB_EXPORT int32_t kb_mixer_active_track_count(const kb_engine* engine);
KB_EXPORT int64_t kb_mixer_track_frames(const kb_engine* engine, int32_t track);

/* --- Player (single-source transport) ----------------------------------- */

/* Load a single file for full playback on the engine clock, streamed from disk
 * (SPEC.md §4.1). Like the mixer, the core decodes and resamples to the engine
 * rate off the audio callback, then publishes the source by an atomic pointer
 * swap, so a load during playback cannot tear a read. No PCM crosses the
 * boundary — every value here is a scalar or a path (§13.2). Loading again
 * replaces the source. Returns KB_ERROR_INVALID_ARGUMENT for a null engine or
 * path, or a file that will not open; KB_OK once published. */
KB_EXPORT kb_result kb_player_load(kb_engine* engine, const char* path);
/* Retire the source. RT-safe: the old source is reclaimed off the audio
 * callback, never freed on it. A no-op for a null or empty player. */
KB_EXPORT void kb_player_unload(kb_engine* engine);
KB_EXPORT void kb_player_play(kb_engine* engine);
/* Ends playback holding the position, so kb_player_play resumes from there.
 * There is no stop-to-zero: rewind with kb_player_seek(engine, 0). */
KB_EXPORT void kb_player_pause(kb_engine* engine);
KB_EXPORT void kb_player_seek(kb_engine* engine, int64_t frame);
/* Playback position and total length in engine-rate frames. Both cross as
 * int64_t but are exact to 2^53 frames — ~5,900 years at 48kHz — so JSI may read
 * them as a JS double. No BigInt. */
KB_EXPORT int64_t kb_player_position(const kb_engine* engine);
KB_EXPORT int64_t kb_player_frames(const kb_engine* engine);
KB_EXPORT int32_t kb_player_is_playing(const kb_engine* engine);

/* --- Beat Analysis ------------------------------------------------------- */

/* Analyze beats in an audio file and fill caller-provided output buffers.
 * The file is opened and decoded internally — no need to call kb_decoder_open
 * first.
 *
 *   bpm_out:         filled with detected BPM (0.0 if detection fails)
 *   beat_times_buf:  caller-allocated float buffer, receives beat times in
 *                    seconds
 *   beat_times_cap:  capacity of beat_times_buf in elements (recommend 1024)
 *   beat_count_out:  filled with number of beats written
 *   downbeat_indices_out: caller-allocated int32 buffer sized to beat_times_cap,
 *                    receives the indices (into the beat list) that are bar-ones;
 *                    each is < *beat_count_out
 *   downbeat_count_out: filled with number of downbeat indices written
 *   waveform_dir:    directory to write the waveform peaks sidecar ("KWAV"
 *                    binary), or NULL to skip waveform generation
 *
 * Returns KB_OK on success (even if no beats found; check *beat_count_out).
 * Returns KB_ERROR_INVALID_ARGUMENT for a null path/output pointer, a file that
 * will not open, or decoded PCM that is unusable: zero channels, a frame count
 * above INT_MAX, or any non-finite (NaN/inf) sample.
 */
KB_EXPORT kb_result kb_analyze_song(
    const char* path,
    float* bpm_out,
    float* beat_times_buf,
    int32_t beat_times_cap,
    int32_t* beat_count_out,
    int32_t* downbeat_indices_out,
    int32_t* downbeat_count_out,
    const char* waveform_dir
);

#ifdef __cplusplus
}
#endif

#endif /* KITBAG_API_H */
