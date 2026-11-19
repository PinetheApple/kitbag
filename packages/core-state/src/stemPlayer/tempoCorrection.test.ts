import { correctedBpm, TEMPO_CORRECTION } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { correctedGrid, scaleBeats } from './tempoCorrection.ts';

const STEP = 0.5;
const STEADY = Array.from({ length: 8 }, (_, i) => i * STEP);
const UNEVEN = [0, 1, 1.5, 3];

const gaps = (beats: readonly number[]) =>
  beats.slice(1).map((beat, i) => beat - (beats[i] ?? 0));

describe('scaling a steady grid', () => {
  it.each([
    [TEMPO_CORRECTION.double, 15, STEP / 2],
    [TEMPO_CORRECTION.half, 4, STEP * 2],
    [TEMPO_CORRECTION.threeHalves, 11, (STEP * 2) / 3],
    [TEMPO_CORRECTION.twoThirds, 5, (STEP * 3) / 2],
  ])('%s gives %i beats spaced evenly', (correction, count, spacing) => {
    const scaled = scaleBeats(STEADY, correction);
    expect(scaled).toHaveLength(count);
    for (const gap of gaps(scaled)) expect(gap).toBeCloseTo(spacing, 9);
    expect(scaled[0]).toBe(0);
  });

  it('×1 hands back the same grid', () => {
    expect(scaleBeats(STEADY, TEMPO_CORRECTION.none)).toBe(STEADY);
  });

  it('keeps an empty grid empty', () => {
    expect(scaleBeats([], TEMPO_CORRECTION.double)).toEqual([]);
  });
});

describe('scaling an uneven grid', () => {
  it.each([
    [TEMPO_CORRECTION.double, [0, 0.5, 1, 1.25, 1.5, 2.25, 3]],
    [TEMPO_CORRECTION.half, [0, 1.5]],
    [TEMPO_CORRECTION.threeHalves, [0, 2 / 3, 7 / 6, 1.5, 2.5]],
    [TEMPO_CORRECTION.twoThirds, [0, 1.25, 3]],
  ])('%s interpolates between the analysed beats', (correction, expected) => {
    const scaled = scaleBeats(UNEVEN, correction);
    expect(scaled).toHaveLength(expected.length);
    scaled.forEach((beat, i) => {
      expect(beat).toBeCloseTo(expected[i] ?? Number.NaN, 9);
    });
  });
});

describe('the anchor beat', () => {
  it('÷2 keeps the beat nearest bar 1 when bar 1 is on an odd beat', () => {
    expect(scaleBeats(STEADY, TEMPO_CORRECTION.half, 1)).toEqual([
      0.5, 1.5, 2.5, 3.5,
    ]);
  });

  it.each(Object.values(TEMPO_CORRECTION))(
    '%s keeps the anchor beat itself',
    (correction) => {
      const anchor = 3;
      expect(scaleBeats(STEADY, correction, anchor)).toContain(STEADY[anchor]);
    },
  );
});

describe('the corrected grid', () => {
  const grid = { beats: STEADY, downbeatIndices: [1, 5] };

  it.each([
    [TEMPO_CORRECTION.double, [2, 6, 10, 14]],
    [TEMPO_CORRECTION.threeHalves, [1, 5, 9]],
  ])('%s keeps the detected meter from bar 1', (correction, downbeats) => {
    const corrected = correctedGrid(grid, correction, STEP);
    expect(corrected.downbeatIndices).toEqual(downbeats);
    expect(corrected.beats[downbeats[0] ?? 0]).toBeCloseTo(STEP, 9);
  });

  it('anchors ÷2 on the beat nearest bar 1 so bar 1 survives', () => {
    const corrected = correctedGrid(grid, TEMPO_CORRECTION.half, STEP);
    expect(corrected.beats).toEqual([0.5, 1.5, 2.5, 3.5]);
    expect(corrected.downbeatIndices).toEqual([0]);
  });

  it('×1 hands back the analysed grid', () => {
    expect(correctedGrid(grid, TEMPO_CORRECTION.none, STEP)).toBe(grid);
  });
});

describe('the corrected tempo', () => {
  it.each([
    [TEMPO_CORRECTION.half, 52],
    [TEMPO_CORRECTION.twoThirds, 104 * (2 / 3)],
    [TEMPO_CORRECTION.none, 104],
    [TEMPO_CORRECTION.threeHalves, 156],
    [TEMPO_CORRECTION.double, 208],
  ])('%s scales 104 BPM to %d', (correction, bpm) => {
    expect(correctedBpm(104, correction)).toBeCloseTo(bpm, 9);
  });

  it('stays unknown without a tempo', () => {
    expect(correctedBpm(null, TEMPO_CORRECTION.double)).toBeNull();
  });
});
