// SPEC §13.2 acceptance for the tuner-snapshot decode. Builds packed values the
// way Tuner::PackSnapshot does, then asserts unpack recovers the fields. The
// last block is a sabotage check: it proves that the two things the decode gets
// right — reading bits above 2^32 without truncation, and sign-extending int16 —
// are load-bearing, by showing a naive decode gives a DIFFERENT, wrong answer.
// So a green run means the bit math is right, not that the assertion is asleep.

import { describe, expect, it } from 'vitest';

import {
  KB_TUNER_SNAPSHOT_FIELDS,
  KB_MAX_GRID_BEATS,
  KB_MAX_TRACKS,
  KB_SOUND_NAMES,
  KB_RESULT,
  KB_ACCENT,
  KB_LATENCY_OFFSET_MS_BOUNDS,
  KB_BAR_PHASE_BOUNDS,
} from '../generated/nativeConstants.gen.ts';
import {
  tunerCents,
  tunerConfidence,
  tunerNote,
  unpackTunerSnapshot,
} from './snapshot.ts';

const WORD = 0x10000; // 2^16
const WORD32 = 0x100000000; // 2^32

/** unsigned 16-bit two's-complement, matching how the engine packs each field. */
function u16(value: number): number {
  return ((value % WORD) + WORD) % WORD;
}

/**
 * Pack the way the engine does (SPEC §13.2, LSB-first): raw field values —
 * cents already ×100, confidence already ×10000 — laid at bits 0/16/32.
 */
function pack(
  noteRaw: number,
  centsScaled: number,
  confScaled: number,
): number {
  return u16(noteRaw) + u16(centsScaled) * WORD + u16(confScaled) * WORD32;
}

describe('unpackTunerSnapshot', () => {
  it('decodes a perfect in-tune A4 at full confidence', () => {
    const packed = pack(69, 0, 10000);
    expect(unpackTunerSnapshot(packed)).toEqual({
      note: 69,
      cents: 0,
      confidence: 1,
    });
  });

  it('decodes the no-pitch sentinel (note -1) via sign extension', () => {
    const packed = pack(-1, 0, 0);
    expect(tunerNote(packed)).toBe(-1);
    expect(tunerConfidence(packed)).toBe(0);
  });

  it('decodes a negative cents offset', () => {
    const packed = pack(69, -2350, 5000);
    expect(tunerCents(packed)).toBeCloseTo(-23.5, 10);
    expect(tunerConfidence(packed)).toBeCloseTo(0.5, 10);
  });

  it('decodes near-max field values without cross-field bleed', () => {
    // note 96, +49.99 cents, confidence 0.9999 — exercises all three words at
    // once, including bits 32-47 that a 32-bit read would drop.
    const packed = pack(96, 4999, 9999);
    expect(unpackTunerSnapshot(packed)).toEqual({
      note: 96,
      cents: 49.99,
      confidence: 0.9999,
    });
  });

  it('field accessors agree with the struct decode', () => {
    const packed = pack(45, -1234, 7500);
    const reading = unpackTunerSnapshot(packed);
    expect(reading.note).toBe(tunerNote(packed));
    expect(reading.cents).toBe(tunerCents(packed));
    expect(reading.confidence).toBe(tunerConfidence(packed));
  });

  // --- sabotage: prove the two hard parts of the decode actually matter -----
  it('proves a 32-bit bitwise extraction drops the confidence bits', () => {
    const packed = pack(69, 0, 9999); // confidence 0.9999 lives in bits 32-47
    // A JS bitwise op coerces `packed` to a 32-bit int FIRST (ToUint32 =
    // packed mod 2^32 = 69), so the confidence word is gone before the shift
    // even runs — the classic trap §13.2 forbids BigInt to avoid.
    const wrongConfidenceBits = (packed >>> 16) & 0xffff;
    expect(wrongConfidenceBits).toBe(0);
    // The division-based decode reads the real bits instead.
    expect(tunerConfidence(packed) * 10000).toBeCloseTo(9999, 6);
  });

  it('proves skipping sign extension mislabels the no-pitch sentinel', () => {
    const packed = pack(-1, 0, 0);
    const rawNoteWord = packed % WORD; // raw 16 bits, unsigned = 65535
    expect(rawNoteWord).toBe(0xffff); // without sign extension the note is 65535
    expect(tunerNote(packed)).toBe(-1); // the decode sign-extends it to -1
  });
});

// --- the generated constants are wired and shaped as the boundary expects ----
describe('nativeConstants.gen', () => {
  it('exposes the §13.7 constants extracted from the engine source', () => {
    expect(KB_MAX_GRID_BEATS).toBe(8192);
    expect(KB_MAX_TRACKS).toBe(16);
    expect(KB_SOUND_NAMES).toEqual([
      'beep',
      'woodblock',
      'click',
      'tom',
      'hihat',
      'cowbell',
    ]);
    expect(KB_RESULT.KB_OK).toBe(0);
    expect(KB_RESULT.KB_ERROR_DEVICE_START_FAILED).toBe(3);
    expect(KB_ACCENT.KB_ACCENT_ACCENTED).toBe(2);
    expect(KB_LATENCY_OFFSET_MS_BOUNDS).toEqual({ min: -100, max: 100 });
    expect(KB_BAR_PHASE_BOUNDS.maxExclusive).toBe(true);
  });

  it('describes the tuner layout the decode reads (48 bits, < 53 mantissa)', () => {
    const { note, cents, confidence } = KB_TUNER_SNAPSHOT_FIELDS;
    expect(note).toEqual({ offset: 0, width: 16, signed: true, scale: 1 });
    expect(cents).toEqual({ offset: 16, width: 16, signed: true, scale: 100 });
    expect(confidence.offset + confidence.width).toBe(48);
    expect(confidence.signed).toBe(false);
  });
});
