// Decode kb_tuner_snapshot (SPEC §13.2). The engine packs one atomic uint64 so a
// poll can never pair note A with note B's cents; 48 bits are used, which is < 53
// mantissa bits, so JS reads the whole thing as an exact double. NO BigInt.
//
// The bit layout — offsets, widths, signedness, ×N scale — is NOT retyped here.
// It comes from KB_TUNER_SNAPSHOT_FIELDS, generated from the kb_tuner_snapshot
// doc-comment table, so this decode cannot drift from Tuner::PackSnapshot
// (SPEC §13.7). This file owns only the *algorithm*: bit fields are extracted by
// division + modulo on a double (JS bitwise ops coerce to int32 and would drop
// bits 32-47), then sign-extended and unscaled.

import {
  KB_TUNER_SNAPSHOT_FIELDS,
  type KbTunerField,
} from '../generated/nativeConstants.gen.ts';

const RADIX = 2;

/** Extract one packed field from `packed`, sign-extended and unscaled. */
function extractField(packed: number, field: KbTunerField): number {
  const modulus = RADIX ** field.width;
  const raw = Math.floor(packed / RADIX ** field.offset) % modulus;
  const signBoundary = RADIX ** (field.width - 1);
  const value = field.signed && raw >= signBoundary ? raw - modulus : raw;
  return value / field.scale;
}

/** Nearest-note MIDI index; -1 = no pitch. Allocation-free for worklet polling. */
export function tunerNote(packed: number): number {
  return extractField(packed, KB_TUNER_SNAPSHOT_FIELDS.note);
}

/** Cents offset from the nearest note. Allocation-free for worklet polling. */
export function tunerCents(packed: number): number {
  return extractField(packed, KB_TUNER_SNAPSHOT_FIELDS.cents);
}

/** Confidence in [0, 1]. Allocation-free for worklet polling. */
export function tunerConfidence(packed: number): number {
  return extractField(packed, KB_TUNER_SNAPSHOT_FIELDS.confidence);
}

export interface TunerReading {
  /** Nearest-note MIDI index; -1 = no pitch. */
  readonly note: number;
  /** Cents offset from `note`. */
  readonly cents: number;
  /** Confidence in [0, 1]. */
  readonly confidence: number;
}

/**
 * Decode the whole reading. Convenience for the JS thread; the 60fps worklet
 * hot path should prefer the single-field accessors above, which do not allocate
 * (SPEC §13.3 — reads must be allocation-light).
 */
export function unpackTunerSnapshot(packed: number): TunerReading {
  return {
    note: tunerNote(packed),
    cents: tunerCents(packed),
    confidence: tunerConfidence(packed),
  };
}
