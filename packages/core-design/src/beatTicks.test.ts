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

  it('draws bars only once beats share a column: 3:00 at 120 BPM in 4/4', () => {
    const beats = Array.from({ length: 360 }, (_, i) => i * 0.5);
    const bars = beats.map((_, i) => i).filter((i) => i % 4 === 0);
    const ticks = beatTicks(beats, bars, 180, 359, COLUMN);
    expect(ticks).toHaveLength(90);
    expect(ticks.every((tick) => tick.tall)).toBe(true);
  });

  it('draws beats and bars together while each beat has its column', () => {
    const beats = Array.from({ length: 16 }, (_, i) => i * 0.5);
    const ticks = beatTicks(beats, [0, 4, 8, 12], 8, 359, COLUMN);
    expect(ticks).toHaveLength(16);
    expect(ticks.filter((tick) => tick.tall)).toHaveLength(4);
  });

  it('merges a dense grid with no downbeats into one short tick per column', () => {
    const beats = Array.from({ length: 2000 }, (_, i) => i * 0.15);
    const ticks = beatTicks(beats, [], 300, 360, COLUMN);
    expect(ticks.length).toBeLessThanOrEqual(360 / COLUMN + 1);
    expect(ticks.some((tick) => tick.tall)).toBe(false);
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
