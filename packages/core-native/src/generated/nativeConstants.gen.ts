// GENERATED — DO NOT EDIT. Owner: native/audio_core (SPEC §13.7).
// Regenerate: pnpm --filter @kitbag/core-native generate
// Verify (CI drift guard): pnpm --filter @kitbag/core-native generate:check
//
// Every value here is extracted from the engine's own source, never retyped.
// Hand-edits are reverted by the next regenerate and fail generate:check.

/** Max beats a single measured grid may carry (KB_MAX_GRID_BEATS). */
export const KB_MAX_GRID_BEATS = 8192;

/** Mixer track count (Mixer::kMaxTracks, SPEC §7.4). */
export const KB_MAX_TRACKS = 16;

/** Beats per bar the engine will hold (Metronome::kMaxBeats); it clamps above this. */
export const KB_MAX_BEATS = 16;

/** Shortest ramp in bars (TempoRamp::kMinBars); the engine clamps below this. */
export const KB_MIN_RAMP_BARS = 1;

/** Longest ramp in bars (TempoRamp::kMaxBars); the engine clamps above this. */
export const KB_MAX_RAMP_BARS = 64;

/** Tempo range the engine clamps to (kMinBpm, kMaxBpm in metronome_types.h). */
export const KB_BPM_BOUNDS = {
  min: 20,
  max: 400,
} as const;

/** Subdivisions per beat (Metronome::kMinSubdivision, kMaxSubdivision); clamped. */
export const KB_SUBDIVISION_BOUNDS = {
  min: 1,
  max: 16,
} as const;

/** Initial sound ids (Metronome::kDefaultNormalSound, kDefaultAccentSound). */
export const KB_DEFAULT_SOUNDS = {
  normal: 0,
  accent: 0,
} as const;

/** Click volume multiplier range (Metronome::kMinVolume, kMaxVolume); the engine clamps to it. */
export const KB_VOLUME_BOUNDS = {
  min: 0,
  max: 2,
} as const;

/** Longest play or mute run in bars (Metronome::kMaxMuteBars); clamped above. */
export const KB_MAX_MUTE_BARS = 16;

/** Play and mute run bounds in bars (Metronome::kMinMuteBars, kMaxMuteBars); clamped. */
export const KB_MUTE_BARS_BOUNDS = {
  min: 1,
  max: 16,
} as const;

/**
 * Time-signature denominators the engine accepts (Metronome::kDenominators,
 * SPEC §17 D1). Anything else leaves the engine's current denominator in place.
 */
export const KB_DENOMINATORS = [2, 4, 8, 16] as const;
export type KbDenominator = (typeof KB_DENOMINATORS)[number];

/** Poly-row beat count the engine holds (Metronome::kMinPolyBeats..kMaxPolyBeats); it clamps outside. */
export const KB_POLY_BEATS_BOUNDS = {
  min: 2,
  max: 16,
} as const;

/** Count-in bar choices (Metronome::kCountInBarChoices); 0 is off, anything else is ignored. */
export const KB_COUNT_IN_BARS = [0, 1, 2, 4] as const;
export type KbCountInBars = (typeof KB_COUNT_IN_BARS)[number];

/** The count-in choice that means off (Metronome::kCountInOff). */
export const KB_COUNT_IN_OFF = 0;

/** Sound id a distinct count-in uses until set (Metronome::kDefaultCountInSound). */
export const KB_DEFAULT_COUNT_IN_SOUND = 1;

/** Tempo-ramp time bounds the engine clamps to (TempoRamp::kMinSeconds, kMaxSeconds). */
export const KB_RAMP_SECONDS_BOUNDS = {
  min: 1,
  max: 3600,
} as const;

/** Denominator BPM is referenced to (Metronome::kBpmReferenceDenominator): quarter note. */
export const KB_BPM_REFERENCE_DENOMINATOR = 4;

/**
 * Metronome sound ids, indexed by native sound id (SPEC §5.3, §13.7). Lowercase
 * engine tokens; display casing is a §12 concern, not an engine constant.
 */
export const KB_SOUND_NAMES = ['beep', 'woodblock', 'click', 'tom', 'hihat', 'cowbell'] as const;
export type KbSoundName = (typeof KB_SOUND_NAMES)[number];

/** kb_result codes. */
export const KB_RESULT = {
  KB_OK: 0,
  KB_ERROR_INVALID_ARGUMENT: 1,
  KB_ERROR_DEVICE_INIT_FAILED: 2,
  KB_ERROR_DEVICE_START_FAILED: 3,
  KB_ERROR_BUSY: 4,
} as const;
export type KB_RESULT = (typeof KB_RESULT)[keyof typeof KB_RESULT];

/** kb_accent enum. */
export const KB_ACCENT = {
  KB_ACCENT_MUTED: 0,
  KB_ACCENT_NORMAL: 1,
  KB_ACCENT_ACCENTED: 2,
} as const;
export type KB_ACCENT = (typeof KB_ACCENT)[keyof typeof KB_ACCENT];

/** kb_ramp_unit enum. */
export const KB_RAMP_UNIT = {
  KB_RAMP_BARS: 0,
  KB_RAMP_SECONDS: 1,
  KB_RAMP_MINUTES: 2,
} as const;
export type KB_RAMP_UNIT = (typeof KB_RAMP_UNIT)[keyof typeof KB_RAMP_UNIT];

/** Metronome output-latency offset range, in ms (kb_metronome_set_latency_offset). */
export const KB_LATENCY_OFFSET_MS_BOUNDS = {
  min: -100,
  max: 100,
} as const;

/** Bar-phase range for the beat sweep (kb_metronome_bar_phase). */
export const KB_BAR_PHASE_BOUNDS = {
  min: 0,
  max: 1,
  maxExclusive: true,
} as const;

/** One packed field of kb_tuner_snapshot. */
export interface KbTunerField {
  readonly offset: number;
  readonly width: number;
  readonly signed: boolean;
  readonly scale: number;
}

/**
 * kb_tuner_snapshot bit layout (SPEC §13.2). LSB-first packed fields; decode in
 * src/host/snapshot.ts reads these so it cannot drift from Tuner::PackSnapshot.
 */
export const KB_TUNER_SNAPSHOT_FIELDS = {
  note: { offset: 0, width: 16, signed: true, scale: 1 },
  cents: { offset: 16, width: 16, signed: true, scale: 100 },
  confidence: { offset: 32, width: 16, signed: false, scale: 10000 },
} as const;

/** Most strings a tuning may carry (KB_TUNER_MAX_STRINGS). */
export const KB_TUNER_MAX_STRINGS = 12;

/** kb_tuner_set_target_string argument selecting auto mode (KB_TUNER_AUTO_STRING). */
export const KB_TUNER_AUTO_STRING = -1;

/** kb_tuner_state string fields when there is none (KB_TUNER_NO_STRING). */
export const KB_TUNER_NO_STRING = -1;

/** kb_tuner_state.target_midi when no note is held (KB_TUNER_NO_NOTE). */
export const KB_TUNER_NO_NOTE = -1;

/** in_tune_ratio from which the current string counts as tuned (KB_TUNER_TUNED_RATIO). */
export const KB_TUNER_TUNED_RATIO = 0.95;

/** A4 reference range and default, in Hz (TuningMode); kb_tuner_set_a4 clamps to it. */
export const KB_TUNER_A4_HZ = {
  min: 415,
  max: 466,
  default: 440,
} as const;

/**
 * Longest the tuner's analysis thread sleeps between setter-queue drains, in
 * microseconds (Tuner::kIdleSleepMicros). A KB_ERROR_BUSY retry waits this long.
 */
export const KB_TUNER_IDLE_SLEEP_MICROS = 2000;

/** kb_tuner_instrument enum: selects the in-tune window table. */
export const KB_TUNER_INSTRUMENT = {
  KB_TUNER_INSTRUMENT_GUITAR: 0,
  KB_TUNER_INSTRUMENT_BASS: 1,
  KB_TUNER_INSTRUMENT_UKULELE: 2,
  KB_TUNER_INSTRUMENT_OTHER: 3,
} as const;
export type KB_TUNER_INSTRUMENT = (typeof KB_TUNER_INSTRUMENT)[keyof typeof KB_TUNER_INSTRUMENT];

/** kb_tuning_status enum. */
export const KB_TUNING_STATUS = {
  KB_TUNING_NOT_MEASURED: 0,
  KB_TUNING_TOO_LOW: 1,
  KB_TUNING_IN_TUNE: 2,
  KB_TUNING_TOO_HIGH: 3,
} as const;
export type KB_TUNING_STATUS = (typeof KB_TUNING_STATUS)[keyof typeof KB_TUNING_STATUS];

/** kb_wrong_string enum: side of the target the heard string lies on. */
export const KB_WRONG_STRING = {
  KB_WRONG_STRING_NONE: 0,
  KB_WRONG_STRING_BELOW: 1,
  KB_WRONG_STRING_ABOVE: 2,
} as const;
export type KB_WRONG_STRING = (typeof KB_WRONG_STRING)[keyof typeof KB_WRONG_STRING];
