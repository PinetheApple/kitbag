import { describe, expect, it } from 'vitest';

import { beatTicks, tickPath } from './beatTicks.ts';

const COLUMN = 3;

describe('beatTicks', () => {
  it('places a beat by its share of the song across the width', () => {
    expect(beatTicks([5], [], 10, 300, COLUMN)).toEqual([
      { x: 150, tall: false },
    ]);
  });

  it('marks downbeats by their index in the grid', () => {
    expect(beatTicks([1, 5], [1], 10, 300, COLUMN)).toEqual([
      { x: 30, tall: false },
      { x: 150, tall: true },
    ]);
  });

  it('keeps one tick per column however long the song, and a downbeat wins it', () => {
    const beats = Array.from({ length: 2000 }, (_, i) => i * 0.15);
    const ticks = beatTicks(beats, [1000], 300, 360, COLUMN);
    expect(ticks.length).toBeLessThanOrEqual(360 / COLUMN + 1);
    expect(ticks.filter((tick) => tick.tall)).toHaveLength(1);
  });

  it('drops beats past the end of the song', () => {
    expect(beatTicks([5, 11], [], 10, 300, COLUMN)).toHaveLength(1);
  });

  it.each([
    ['no duration', 0, 300],
    ['no width yet', 10, 0],
  ])('has no ticks with %s', (_, duration, width) => {
    expect(beatTicks([1], [], duration, width, COLUMN)).toEqual([]);
  });
});

describe('tickPath', () => {
  it('stands each tick on the floor of the lane', () => {
    expect(tickPath([{ x: 3, tall: false }], 64, 8)).toBe('M3 64V56');
  });
});
