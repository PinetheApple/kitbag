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
