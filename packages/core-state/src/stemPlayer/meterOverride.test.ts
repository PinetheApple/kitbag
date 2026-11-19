import { GRID_METER, NO_METER_OVERRIDE, type BarMark } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { FALLBACK_BEATS_PER_BAR } from './barMeter.ts';
import { barMarkDownbeats } from './bars.ts';
import { overrideDownbeats } from './meterOverride.ts';

const BEAT_SECONDS = 0.5;
const TRIPLE = GRID_METER.triple;
const QUADRUPLE = GRID_METER.quadruple;
const METER_ONLY = { ...NO_METER_OVERRIDE, meterBeatsPerBar: TRIPLE };

function evenBeats(count: number, spacing = BEAT_SECONDS, offset = 0) {
  return Array.from({ length: count }, (_unused, i) => offset + i * spacing);
}

describe('downbeats under a meter override', () => {
  it('keeps the detected downbeats without an override', () => {
    const downbeatIndices = [0, 4, 8];
    const grid = { beats: evenBeats(12), downbeatIndices };
    expect(overrideDownbeats(grid, NO_METER_OVERRIDE)).toBe(downbeatIndices);
  });

  it('counts the overridden meter from the detected bar one', () => {
    const grid = { beats: evenBeats(12), downbeatIndices: [1, 5, 9] };
    expect(overrideDownbeats(grid, METER_ONLY)).toEqual([1, 4, 7, 10]);
  });

  it('marks bars before the anchor too', () => {
    const grid = { beats: evenBeats(12), downbeatIndices: [5, 9] };
    expect(overrideDownbeats(grid, METER_ONLY)).toEqual([2, 5, 8, 11]);
  });

  it('anchors an overridden meter at the first beat when nothing was detected', () => {
    const grid = { beats: evenBeats(7), downbeatIndices: [] };
    expect(overrideDownbeats(grid, METER_ONLY)).toEqual([0, 3, 6]);
  });

  it('moves bar one to the beat nearest the stored time, keeping the detected spacing', () => {
    const grid = { beats: evenBeats(12), downbeatIndices: [0, 4, 8] };
    expect(
      overrideDownbeats(grid, { ...NO_METER_OVERRIDE, barOneSeconds: 1.1 }),
    ).toEqual([2, 6, 10]);
  });

  it('keeps a three-beat detected spacing when only bar one moves', () => {
    const grid = { beats: evenBeats(10), downbeatIndices: [0, 3, 6, 9] };
    expect(
      overrideDownbeats(grid, { ...NO_METER_OVERRIDE, barOneSeconds: 0.5 }),
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
      overrideDownbeats(grid, {
        ...NO_METER_OVERRIDE,
        barOneSeconds: BEAT_SECONDS,
      }),
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
    expect(
      overrideDownbeats(grid, { ...NO_METER_OVERRIDE, barOneSeconds }),
    ).toEqual([1, 5, 9, 13]);
  });

  it('finds the same bar one after re-analysis halves the beat count', () => {
    const barOneSeconds = evenBeats(16)[6] ?? 0;
    const grid = {
      beats: evenBeats(8, 2 * BEAT_SECONDS),
      downbeatIndices: [0, 4],
    };
    expect(
      overrideDownbeats(grid, { ...NO_METER_OVERRIDE, barOneSeconds }),
    ).toEqual([3, 7]);
  });
});

function marked(bars: readonly BarMark[], count: number) {
  return {
    beats: evenBeats(count),
    downbeatIndices: barMarkDownbeats(bars, count),
  };
}

const barOneAt = (beat: number) => ({
  ...NO_METER_OVERRIDE,
  barOneSeconds: beat * BEAT_SECONDS,
});

describe('downbeats of a meter map under an override', () => {
  const MAP = marked(
    [
      { beat: 0, beatsPerBar: QUADRUPLE },
      { beat: 4, beatsPerBar: TRIPLE },
    ],
    13,
  );

  it('makes the whole song the chosen meter', () => {
    const fourFour = { ...NO_METER_OVERRIDE, meterBeatsPerBar: QUADRUPLE };
    expect(overrideDownbeats(MAP, fourFour)).toEqual([0, 4, 8, 12]);
  });

  it('shifts the map, keeping each bar its own meter', () => {
    expect(overrideDownbeats(MAP, barOneAt(1))).toEqual([1, 5, 8, 11]);
  });
});

describe('downbeats after a pickup bar under an override', () => {
  const ONE_BEAT_PICKUP = marked(
    [
      { beat: 0, beatsPerBar: 1 },
      { beat: 1, beatsPerBar: QUADRUPLE },
    ],
    13,
  );
  const TWO_BEAT_PICKUP = marked(
    [
      { beat: 0, beatsPerBar: 2 },
      { beat: 2, beatsPerBar: QUADRUPLE },
    ],
    12,
  );

  it('counts a chosen meter from the first full bar', () => {
    expect(overrideDownbeats(ONE_BEAT_PICKUP, METER_ONLY)).toEqual([
      1, 4, 7, 10,
    ]);
    expect(overrideDownbeats(TWO_BEAT_PICKUP, METER_ONLY)).toEqual([
      2, 5, 8, 11,
    ]);
  });

  it('moves the first full bar to the chosen bar one', () => {
    expect(overrideDownbeats(ONE_BEAT_PICKUP, barOneAt(2))).toEqual([2, 6, 10]);
    expect(overrideDownbeats(TWO_BEAT_PICKUP, barOneAt(3))).toEqual([3, 7, 11]);
  });
});
