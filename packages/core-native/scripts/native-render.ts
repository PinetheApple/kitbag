import type { NativeConstants } from './native-constants.ts';
import type { Bounds, EnumMember, TunerField } from './native-parsers.ts';

function renderEnum(name: string, members: readonly EnumMember[]): string {
  const lines = members.map((mem) => `  ${mem.name}: ${String(mem.value)},`);
  return (
    `export const ${name} = {\n${lines.join('\n')}\n} as const;\n` +
    `export type ${name} = (typeof ${name})[keyof typeof ${name}];\n`
  );
}

function renderBounds(name: string, bounds: Bounds): string {
  return (
    `export const ${name} = {\n  min: ${String(bounds.min)},\n` +
    `  max: ${String(bounds.max)},\n} as const;\n`
  );
}

function renderField(field: TunerField): string {
  return (
    `{ offset: ${String(field.offset)}, width: ${String(field.width)}, ` +
    `signed: ${String(field.signed)}, scale: ${String(field.scale)} }`
  );
}

/** Deterministic, prettier-free (`.gen.ts` is prettier-ignored) TS source. */
export function renderConstants(c: NativeConstants): string {
  const soundNames = c.soundNames.map((n) => `'${n}'`).join(', ');
  return `// GENERATED — DO NOT EDIT. Owner: native/audio_core (SPEC §13.7).
// Regenerate: pnpm --filter @kitbag/core-native generate
// Verify (CI drift guard): pnpm --filter @kitbag/core-native generate:check
//
// Every value here is extracted from the engine's own source, never retyped.
// Hand-edits are reverted by the next regenerate and fail generate:check.

/** Max beats a single measured grid may carry (KB_MAX_GRID_BEATS). */
export const KB_MAX_GRID_BEATS = ${String(c.maxGridBeats)};

/** Mixer track count (Mixer::kMaxTracks, SPEC §7.4). */
export const KB_MAX_TRACKS = ${String(c.maxTracks)};

/** Beats per bar the engine will hold (Metronome::kMaxBeats); it clamps above this. */
export const KB_MAX_BEATS = ${String(c.maxBeats)};

/** Shortest ramp in bars (TempoRamp::kMinBars); the engine clamps below this. */
export const KB_MIN_RAMP_BARS = ${String(c.minRampBars)};

/** Longest ramp in bars (TempoRamp::kMaxBars); the engine clamps above this. */
export const KB_MAX_RAMP_BARS = ${String(c.maxRampBars)};

/** Smallest ramp step in BPM (TempoRamp::kMinStepBpm); the engine clamps below this. */
export const KB_MIN_RAMP_STEP_BPM = ${String(c.minRampStepBpm)};

/** Tempo range the engine clamps to (kMinBpm, kMaxBpm in metronome_types.h). */
${renderBounds('KB_BPM_BOUNDS', c.bpm)}
/** Subdivisions per beat (Metronome::kMinSubdivision, kMaxSubdivision); clamped. */
${renderBounds('KB_SUBDIVISION_BOUNDS', c.subdivision)}
/** Initial sound ids (Metronome::kDefaultNormalSound, kDefaultAccentSound). */
export const KB_DEFAULT_SOUNDS = {
  normal: ${String(c.defaultSounds.normal)},
  accent: ${String(c.defaultSounds.accent)},
} as const;

/** Click volume multiplier range (Metronome::kMinVolume, kMaxVolume); the engine clamps to it. */
${renderBounds('KB_VOLUME_BOUNDS', c.volume)}
/** Linear stem and master gain range (Mixer::kMinGain, kMaxGain); the engine clamps to it. */
${renderBounds('KB_MIXER_GAIN_BOUNDS', c.mixerGain)}
/** Longest play or mute run in bars (Metronome::kMaxMuteBars); clamped above. */
export const KB_MAX_MUTE_BARS = ${String(c.muteBars.max)};

/** Play and mute run bounds in bars (Metronome::kMinMuteBars, kMaxMuteBars); clamped. */
${renderBounds('KB_MUTE_BARS_BOUNDS', c.muteBars)}
/**
 * Time-signature denominators the engine accepts (Metronome::kDenominators,
 * SPEC §17 D1). Anything else leaves the engine's current denominator in place.
 */
export const KB_DENOMINATORS = [${c.denominators.map(String).join(', ')}] as const;
export type KbDenominator = (typeof KB_DENOMINATORS)[number];

/** Poly-row beat count the engine holds (Metronome::kMinPolyBeats..kMaxPolyBeats); it clamps outside. */
export const KB_POLY_BEATS_BOUNDS = {
  min: ${String(c.minPolyBeats)},
  max: ${String(c.maxPolyBeats)},
} as const;

/** Count-in bar choices (Metronome::kCountInBarChoices); 0 is off, anything else is ignored. */
export const KB_COUNT_IN_BARS = [${c.countInBars.map(String).join(', ')}] as const;
export type KbCountInBars = (typeof KB_COUNT_IN_BARS)[number];

/** The count-in choice that means off (Metronome::kCountInOff). */
export const KB_COUNT_IN_OFF = ${String(c.countInOff)};

/** Sound id a distinct count-in uses until set (Metronome::kDefaultCountInSound). */
export const KB_DEFAULT_COUNT_IN_SOUND = ${String(c.defaultCountInSound)};

/** Tempo-ramp time bounds the engine clamps to (TempoRamp::kMinSeconds, kMaxSeconds). */
${renderBounds('KB_RAMP_SECONDS_BOUNDS', c.rampSeconds)}
/** Denominator BPM is referenced to (Metronome::kBpmReferenceDenominator): quarter note. */
export const KB_BPM_REFERENCE_DENOMINATOR = ${String(c.bpmReferenceDenominator)};

/**
 * Metronome sound ids, indexed by native sound id (SPEC §5.3, §13.7). Lowercase
 * engine tokens; display casing is a §12 concern, not an engine constant.
 */
export const KB_SOUND_NAMES = [${soundNames}] as const;
export type KbSoundName = (typeof KB_SOUND_NAMES)[number];

/** kb_result codes. */
${renderEnum('KB_RESULT', c.result)}
/** kb_accent enum. */
${renderEnum('KB_ACCENT', c.accent)}
/** kb_ramp_unit enum. */
${renderEnum('KB_RAMP_UNIT', c.rampUnit)}
/** kb_ramp_state enum (kb_metronome_ramp_state). */
${renderEnum('KB_RAMP_STATE', c.rampState)}
/** Metronome output-latency offset range, in ms (kb_metronome_set_latency_offset). */
export const KB_LATENCY_OFFSET_MS_BOUNDS = {
  min: ${String(c.latencyOffsetMsBounds.min)},
  max: ${String(c.latencyOffsetMsBounds.max)},
} as const;

/** Bar-phase range for the beat sweep (kb_metronome_bar_phase). */
export const KB_BAR_PHASE_BOUNDS = {
  min: ${String(c.barPhaseBounds.min)},
  max: ${String(c.barPhaseBounds.max)},
  maxExclusive: ${String(c.barPhaseBounds.maxExclusive)},
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
  note: ${renderField(c.tunerFields.note)},
  cents: ${renderField(c.tunerFields.cents)},
  confidence: ${renderField(c.tunerFields.confidence)},
} as const;

/** Most strings a tuning may carry (KB_TUNER_MAX_STRINGS). */
export const KB_TUNER_MAX_STRINGS = ${String(c.tunerMaxStrings)};

/** kb_tuner_set_target_string argument selecting auto mode (KB_TUNER_AUTO_STRING). */
export const KB_TUNER_AUTO_STRING = ${String(c.tunerAutoString)};

/** kb_tuner_state string fields when there is none (KB_TUNER_NO_STRING). */
export const KB_TUNER_NO_STRING = ${String(c.tunerNoString)};

/** kb_tuner_state.target_midi when no note is held (KB_TUNER_NO_NOTE). */
export const KB_TUNER_NO_NOTE = ${String(c.tunerNoNote)};

/** in_tune_ratio from which the current string counts as tuned (KB_TUNER_TUNED_RATIO). */
export const KB_TUNER_TUNED_RATIO = ${String(c.tunerTunedRatio)};

/** A4 reference range and default, in Hz (TuningMode); kb_tuner_set_a4 clamps to it. */
export const KB_TUNER_A4_HZ = {
  min: ${String(c.tunerA4Hz.min)},
  max: ${String(c.tunerA4Hz.max)},
  default: ${String(c.tunerA4Hz.default)},
} as const;

/**
 * Longest the tuner's analysis thread sleeps between setter-queue drains, in
 * microseconds (Tuner::kIdleSleepMicros). A KB_ERROR_BUSY retry waits this long.
 */
export const KB_TUNER_IDLE_SLEEP_MICROS = ${String(c.tunerIdleSleepMicros)};

/** kb_tuner_instrument enum: selects the in-tune window table. */
${renderEnum('KB_TUNER_INSTRUMENT', c.tunerInstrument)}
/** kb_tuning_status enum. */
${renderEnum('KB_TUNING_STATUS', c.tuningStatus)}
/** kb_wrong_string enum: side of the target the heard string lies on. */
${renderEnum('KB_WRONG_STRING', c.wrongString)}`;
}
