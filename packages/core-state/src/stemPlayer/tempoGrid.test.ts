import {
  TEMPO_MODE,
  TEMPO_SOURCE,
  type BundleTempo,
  type StemSetRecord,
} from '@kitbag/core-db';
import { packFloat32, unpackFloat32 } from '@kitbag/core-db/src/packing';
import { describe, expect, it } from 'vitest';

import { record, stem } from './store.test-helper.ts';
import {
  constantBars,
  constantBeats,
  effectiveGrid,
  tempoModeOf,
} from './tempoGrid.ts';

const BEAT_SECONDS = 0.5;
const ONE_MS = 0.001;
const MICROSECOND_DIGITS = 6;

function follow(change: Partial<BundleTempo> = {}): BundleTempo {
  return {
    mode: TEMPO_MODE.follow,
    bpm: 120,
    anchor: 0,
    beatsPerBar: 3,
    source: TEMPO_SOURCE.detected,
    ...change,
  };
}

const DRIFTING_BEATS = [0, 0.55, 1.1, 1.65, 2.2, 2.75, 3.3, 3.85];
const THREE_FOUR = [{ beat: 0, beatsPerBar: 3 }];

function song(change: Partial<StemSetRecord>): StemSetRecord {
  return record([stem(1, { durationSec: 4 })], {
    beats: DRIFTING_BEATS,
    bars: THREE_FOUR,
    tempo: follow(),
    ...change,
  });
}

describe("StemDeck's constant beats", () => {
  it('span the whole song from the anchor', () => {
    const { beats, anchorIndex } = constantBeats(120, 1.3, 10);
    expect(beats[0]).toBeCloseTo(0.3, MICROSECOND_DIGITS);
    expect(beats.at(-1)).toBeLessThanOrEqual(10);
    expect(beats.at(-1)).toBeGreaterThan(10 - BEAT_SECONDS);
    expect(beats[anchorIndex]).toBeCloseTo(1.3, MICROSECOND_DIGITS);
    beats.slice(1).forEach((beat, i) => {
      expect(beat - (beats[i] ?? 0)).toBeCloseTo(
        BEAT_SECONDS,
        MICROSECOND_DIGITS,
      );
    });
  });

  it('include both ends when they land exactly', () => {
    expect(constantBeats(120, 0, 2)).toEqual({
      beats: [0, 0.5, 1, 1.5, 2],
      anchorIndex: 0,
    });
  });

  it('match a stored constant export within 1 ms across a long song', () => {
    const [bpm, anchor, duration] = [127.3, 7.77, 420];
    const period = 60 / bpm;
    const exported: number[] = [];
    let first = anchor;
    while (first - period >= 0) first -= period;
    for (let t = first; t <= duration; t += period) exported.push(t);
    const stored = unpackFloat32(packFloat32(exported));
    const { beats, anchorIndex } = constantBeats(bpm, anchor, duration);
    expect(anchorIndex).toBeGreaterThan(0);
    expect(beats).toHaveLength(stored.length);
    beats.forEach((beat, i) => {
      expect(Math.abs(beat - (stored[i] ?? Infinity))).toBeLessThan(ONE_MS);
    });
  });

  it('keep a last beat that lands on the end only through rounding', () => {
    const { beats } = constantBeats(90, 2.1, 4.1);
    expect(beats).toHaveLength(7);
    expect(beats.at(-1)).toBe(4.1);
  });

  it("round beat times as StemDeck's round(t, 6) does", () => {
    const { beats } = constantBeats(102.4, 2.24, 108.3);
    expect(beats.at(-1)).toEqual(108.294687);
  });

  it('mark bar one on the anchor beat', () => {
    expect(constantBars(9, 4)).toEqual([{ beat: 1, beatsPerBar: 4 }]);
  });
});

describe('the tempo mode in effect', () => {
  it("is the bundle's until one is chosen", () => {
    expect(tempoModeOf(song({}))).toBe(TEMPO_MODE.follow);
    expect(tempoModeOf(song({ chosenTempoMode: TEMPO_MODE.constant }))).toBe(
      TEMPO_MODE.constant,
    );
  });

  it('is none for a bundle without tempo', () => {
    expect(tempoModeOf(song({ tempo: null }))).toBeNull();
  });
});

describe('the effective grid', () => {
  it("is the bundle's own beats and bars in the bundle's mode", () => {
    expect(effectiveGrid(song({}))).toEqual({
      beats: DRIFTING_BEATS,
      downbeatIndices: [0, 3, 6],
    });
  });

  it('is the stored grid for a bundle without tempo', () => {
    const grid = effectiveGrid(song({ tempo: null }));
    expect(grid.beats).toBe(DRIFTING_BEATS);
  });

  it('is rebuilt at the fitted tempo once constant is chosen', () => {
    const grid = effectiveGrid(song({ chosenTempoMode: TEMPO_MODE.constant }));
    expect(grid.beats).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]);
  });

  it('marks even bars from the anchor, not the drifting bar lines', () => {
    const grid = effectiveGrid(
      song({
        tempo: follow({ anchor: 0.5, beatsPerBar: 4 }),
        chosenTempoMode: TEMPO_MODE.constant,
      }),
    );
    expect(grid.downbeatIndices).toEqual([1, 5]);
  });

  it('keeps the stored grid of a constant export', () => {
    const tempo = follow({ mode: TEMPO_MODE.constant, anchor: 0.5 });
    const grid = effectiveGrid(song({ tempo }));
    expect(grid.beats).toBe(DRIFTING_BEATS);
  });

  it('keeps the stored grid when a follow tempo has no fit to rebuild from', () => {
    const tempo = follow({ bpm: null, anchor: null });
    const grid = effectiveGrid(song({ tempo }), TEMPO_MODE.constant);
    expect(grid.beats).toBe(DRIFTING_BEATS);
  });
});
