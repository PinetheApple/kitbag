import { describe, expect, it } from 'vitest';

import {
  pushTap,
  tapTempoBpm,
  tapTimeoutMs,
  TAP_WINDOW_INTERVALS,
} from './tapTempo.ts';
import type { BpmBounds } from './bpmBounds.ts';

const MS_PER_MINUTE = 60000;

// Mirrors core-state's BPM_BOUNDS shape; the screen passes the real one.
const BOUNDS: BpmBounds = { min: 20, max: 400 };
const TIMEOUT = tapTimeoutMs(BOUNDS);

const seriesAt = (bpm: number, count: number) =>
  Array.from({ length: count }, (_u, i) => i * (MS_PER_MINUTE / bpm));

describe('tapTempoBpm', () => {
  it('reads the tempo tapped', () => {
    expect(tapTempoBpm(seriesAt(120, 5))).toBe(120);
    expect(tapTempoBpm(seriesAt(76, 3))).toBe(76);
  });

  it('averages an uneven finger rather than following the last gap', () => {
    // 500/450/550 ms: mean 500 -> 120 BPM, last interval alone would say 109.
    expect(tapTempoBpm([0, 500, 950, 1500])).toBe(120);
  });

  it('says nothing from a single tap', () => {
    expect(tapTempoBpm([1000])).toBeUndefined();
    expect(tapTempoBpm([])).toBeUndefined();
  });

  it('says nothing about two taps at the same instant', () => {
    expect(tapTempoBpm([1000, 1000])).toBeUndefined();
  });
});

describe('pushTap', () => {
  it('starts a new series after a pause instead of averaging across it', () => {
    expect(pushTap([0, 500], 500 + TIMEOUT + 1, BOUNDS)).toEqual([
      500 + TIMEOUT + 1,
    ]);
  });

  // A fixed 2 s timeout sits at 30 BPM, which would put the bottom of the §5.2
  // range out of TAP's reach entirely.
  it('keeps a series tapped at the slowest tempo the range allows', () => {
    const slowestInterval = MS_PER_MINUTE / BOUNDS.min;
    const taps = [0, slowestInterval, slowestInterval * 2].reduce<
      readonly number[]
    >((acc, now) => pushTap(acc, now, BOUNDS), []);
    expect(taps).toHaveLength(3);
    expect(tapTempoBpm(taps)).toBe(BOUNDS.min);
  });

  it('keeps only the averaging window', () => {
    const taps = seriesAt(120, 10).reduce<readonly number[]>(
      (acc, now) => pushTap(acc, now, BOUNDS),
      [],
    );
    expect(taps).toHaveLength(TAP_WINDOW_INTERVALS + 1);
  });

  it('keeps taps inside the window and still reads their tempo', () => {
    const taps = [0, 500, 1000].reduce<readonly number[]>(
      (acc, now) => pushTap(acc, now, BOUNDS),
      [],
    );
    expect(taps).toEqual([0, 500, 1000]);
    expect(tapTempoBpm(taps)).toBe(120);
  });
});
