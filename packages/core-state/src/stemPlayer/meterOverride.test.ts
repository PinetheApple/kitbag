import { GRID_METER, NO_METER_OVERRIDE as NO_OVERRIDE } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { FALLBACK_BEATS_PER_BAR } from './barMeter.ts';
import { nearestBeat, overrideDownbeats } from './meterOverride.ts';

const BEAT_SECONDS = 0.5;
const TRIPLE = GRID_METER.triple;

function evenBeats(count: number, spacing = BEAT_SECONDS, offset = 0) {
  return Array.from({ length: count }, (_unused, i) => offset + i * spacing);
}

describe('downbeats under a meter override', () => {
  it('keeps the detected downbeats without an override', () => {
    const downbeatIndices = [0, 4, 8];
    const grid = { beats: evenBeats(12), downbeatIndices };
    expect(overrideDownbeats(grid, NO_OVERRIDE)).toBe(downbeatIndices);
  });

  it('counts the overridden meter from the detected bar one', () => {
    const grid = { beats: evenBeats(12), downbeatIndices: [1, 5, 9] };
    expect(
      overrideDownbeats(grid, { ...NO_OVERRIDE, meterBeatsPerBar: TRIPLE }),
    ).toEqual([1, 4, 7, 10]);
  });

  it('marks bars before the anchor too', () => {
    const grid = { beats: evenBeats(12), downbeatIndices: [5, 9] };
    expect(
      overrideDownbeats(grid, { ...NO_OVERRIDE, meterBeatsPerBar: TRIPLE }),
    ).toEqual([2, 5, 8, 11]);
  });

  it('anchors an overridden meter at the first beat when nothing was detected', () => {
    const grid = { beats: evenBeats(7), downbeatIndices: [] };
    expect(
      overrideDownbeats(grid, { ...NO_OVERRIDE, meterBeatsPerBar: TRIPLE }),
    ).toEqual([0, 3, 6]);
  });

  it('moves bar one to the beat nearest the stored time, keeping the detected spacing', () => {
    const grid = { beats: evenBeats(12), downbeatIndices: [0, 4, 8] };
    expect(
      overrideDownbeats(grid, { ...NO_OVERRIDE, barOneSeconds: 1.1 }),
    ).toEqual([2, 6, 10]);
  });

  it('keeps a three-beat detected spacing when only bar one moves', () => {
    const grid = { beats: evenBeats(10), downbeatIndices: [0, 3, 6, 9] };
    expect(
      overrideDownbeats(grid, { ...NO_OVERRIDE, barOneSeconds: 0.5 }),
    ).toEqual([1, 4, 7]);
  });

  it('falls back to the default meter when no spacing was detected', () => {
    const grid = { beats: evenBeats(10), downbeatIndices: [] };
    const anchor = 1;
    const expected = [
      anchor,
      anchor + FALLBACK_BEATS_PER_BAR,
      anchor + 2 * FALLBACK_BEATS_PER_BAR,
    ];
    expect(
      overrideDownbeats(grid, { ...NO_OVERRIDE, barOneSeconds: BEAT_SECONDS }),
    ).toEqual(expected);
  });

  it('applies both overrides together', () => {
    const grid = { beats: evenBeats(11), downbeatIndices: [0, 4, 8] };
    expect(
      overrideDownbeats(grid, { meterBeatsPerBar: TRIPLE, barOneSeconds: 1.5 }),
    ).toEqual([0, 3, 6, 9]);
  });

  it('returns nothing for an empty grid', () => {
    const grid = { beats: [], downbeatIndices: [] };
    expect(
      overrideDownbeats(grid, { meterBeatsPerBar: TRIPLE, barOneSeconds: 1 }),
    ).toEqual([]);
  });

  it('clamps a bar one outside the grid to the nearest end', () => {
    const grid = { beats: evenBeats(8, BEAT_SECONDS, 1), downbeatIndices: [] };
    const override = { meterBeatsPerBar: TRIPLE, barOneSeconds: 0 };
    expect(overrideDownbeats(grid, override)).toEqual([0, 3, 6]);
    expect(overrideDownbeats(grid, { ...override, barOneSeconds: 99 })).toEqual(
      [1, 4, 7],
    );
  });

  it('finds the same bar one after re-analysis nudges every beat', () => {
    const before = evenBeats(16);
    const barOneSeconds = before[5] ?? 0;
    const grid = {
      beats: evenBeats(16, BEAT_SECONDS, 0.02),
      downbeatIndices: [0, 4, 8, 12],
    };
    expect(overrideDownbeats(grid, { ...NO_OVERRIDE, barOneSeconds })).toEqual([
      1, 5, 9, 13,
    ]);
  });

  it('finds the same bar one after re-analysis halves the beat count', () => {
    const barOneSeconds = evenBeats(16)[6] ?? 0;
    const grid = {
      beats: evenBeats(8, 2 * BEAT_SECONDS),
      downbeatIndices: [0, 4],
    };
    expect(overrideDownbeats(grid, { ...NO_OVERRIDE, barOneSeconds })).toEqual([
      3, 7,
    ]);
  });
});

describe('the beat nearest a time', () => {
  it('picks the closer beat', () => {
    expect(nearestBeat([0, 1, 2], 1.2)).toBe(1);
    expect(nearestBeat([0, 1, 2], 1.6)).toBe(2);
  });

  it('picks the earlier beat on a tie', () => {
    expect(nearestBeat([0, 1], 0.5)).toBe(0);
  });

  it('clamps to the ends of the grid', () => {
    expect(nearestBeat([1, 2], -5)).toBe(0);
    expect(nearestBeat([1, 2], 50)).toBe(1);
  });

  it('has no beat on an empty grid', () => {
    expect(nearestBeat([], 1)).toBeNull();
  });
});
