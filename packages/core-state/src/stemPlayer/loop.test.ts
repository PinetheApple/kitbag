import { KB_MAX_GRID_BEATS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { clickGrid, loopBetween, snapToBeat } from './loop.ts';

const BEATS = [0.5, 1.0, 1.5, 2.0, 2.5];

describe('A-B loop beat snapping', () => {
  it('snaps a point to the nearest beat', () => {
    expect(snapToBeat(1.2, BEATS)).toBe(1.0);
    expect(snapToBeat(1.3, BEATS)).toBe(1.5);
    expect(snapToBeat(9, BEATS)).toBe(2.5);
  });

  it('leaves a point alone when the song has no grid', () => {
    expect(snapToBeat(1.234, [])).toBe(1.234);
  });

  it('snaps both ends and orders them', () => {
    expect(loopBetween(2.1, 0.9, BEATS)).toEqual({
      startSec: 1.0,
      endSec: 2.0,
    });
  });

  it('moves an end that collapses onto the start to the next beat', () => {
    expect(loopBetween(1.4, 1.6, BEATS)).toEqual({
      startSec: 1.5,
      endSec: 2.0,
    });
  });

  it('refuses a loop with no room after its start', () => {
    expect(loopBetween(2.5, 2.6, BEATS)).toBeNull();
    expect(loopBetween(1, 1, [])).toBeNull();
  });
});

describe('the click grid', () => {
  it('keeps the first KB_MAX_GRID_BEATS beats of a longer song', () => {
    const beats = Array.from(
      { length: KB_MAX_GRID_BEATS + 3 },
      (_, i) => i / 2,
    );
    const grid = clickGrid(beats);
    expect(grid).toHaveLength(KB_MAX_GRID_BEATS);
    expect(grid[0]).toBe(0);
  });
});
