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

/** Longest ramp in bars (Metronome::kMaxRampBars); the engine clamps above this. */
export const KB_MAX_RAMP_BARS = 64;

/** Longest play or mute run in bars (Metronome::kMaxMuteBars); clamped above. */
export const KB_MAX_MUTE_BARS = 16;

/**
 * Time-signature denominators the engine accepts (Metronome::kDenominators,
 * SPEC §17 D1). Anything else leaves the engine's current denominator in place.
 */
export const KB_DENOMINATORS = [2, 4, 8, 16] as const;
export type KbDenominator = (typeof KB_DENOMINATORS)[number];

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
