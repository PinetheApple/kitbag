import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import type { BpmBounds } from './bpmBounds.ts';
import {
  clampBpm,
  FINE_DP_PER_BPM,
  FINE_SPEED_DP_PER_S,
  FULL_SPEED_DP_PER_S,
  MAX_SPEED_GAIN,
  REVERSAL_DP,
  speedGain,
  startSwipe,
  swipeTempo,
  type SwipeTempo,
} from './swipeTempo.ts';

const BOUNDS: BpmBounds = { min: 20, max: 400 };

const SLOW = 100;
const FAST = 2000;
const DP_PER_FRAME = 2;

function drag(from: SwipeTempo, distance: number, velocity: number) {
  const frames = Math.ceil(Math.abs(distance) / DP_PER_FRAME);
  let swipe = from;
  for (let frame = 1; frame <= frames; frame += 1) {
    const y = from.translationY + (distance * frame) / frames;
    swipe = swipeTempo(swipe, y, velocity, BOUNDS);
  }
  return swipe;
}

const up = (dp: number) => -dp;

const SPEC_FINE_DP_PER_BPM = 14;

describe('speedGain', () => {
  it('keeps the fine rate SPEC §5.2 states', () => {
    expect(FINE_DP_PER_BPM).toBe(SPEC_FINE_DP_PER_BPM);
  });

  it('keeps a slow drag at the fine rate', () => {
    expect(speedGain(SLOW)).toBe(1);
    expect(speedGain(-FINE_SPEED_DP_PER_S)).toBe(1);
  });

  it('caps a fast drag at the maximum gain', () => {
    expect(speedGain(FULL_SPEED_DP_PER_S)).toBe(MAX_SPEED_GAIN);
    expect(speedGain(-100000)).toBe(MAX_SPEED_GAIN);
  });

  it('rises with speed in between', () => {
    const mid = (FINE_SPEED_DP_PER_S + FULL_SPEED_DP_PER_S) / 2;
    expect(speedGain(mid)).toBeGreaterThan(1);
    expect(speedGain(mid)).toBeLessThan(MAX_SPEED_GAIN);
  });
});

describe('swipeTempo', () => {
  it('moves one BPM per fine step on a slow drag', () => {
    const start = startSwipe(120);
    expect(drag(start, up(FINE_DP_PER_BPM), SLOW).bpm).toBe(121);
    expect(drag(start, up(FINE_DP_PER_BPM - 1), SLOW).bpm).toBe(120);
    expect(drag(start, FINE_DP_PER_BPM, SLOW).bpm).toBe(119);
  });

  it('covers the same distance many times further on a fast drag', () => {
    const distance = up(FINE_DP_PER_BPM * 10);
    expect(drag(startSwipe(120), distance, SLOW).bpm).toBe(130);
    expect(drag(startSwipe(120), distance, FAST).bpm).toBe(
      120 + 10 * MAX_SPEED_GAIN,
    );
  });

  it('pins at the ceiling and moves on the next step back down', () => {
    const top = drag(startSwipe(390), up(FINE_DP_PER_BPM * 100), FAST);
    expect(top.bpm).toBe(BOUNDS.max);
    expect(drag(top, FINE_DP_PER_BPM, SLOW).bpm).toBe(BOUNDS.max - 1);
  });

  it('pins at the floor and moves on the next step back up', () => {
    const bottom = drag(startSwipe(30), FINE_DP_PER_BPM * 100, FAST);
    expect(bottom.bpm).toBe(BOUNDS.min);
    expect(drag(bottom, up(FINE_DP_PER_BPM), SLOW).bpm).toBe(BOUNDS.min + 1);
  });

  it('answers a reversal within one step, whatever was left over', () => {
    const climbed = drag(startSwipe(120), up(FINE_DP_PER_BPM * 2 - 1), SLOW);
    expect(climbed.bpm).toBe(121);
    expect(drag(climbed, FINE_DP_PER_BPM, SLOW).bpm).toBe(120);
  });

  it('keeps leftover travel through tremor smaller than a reversal', () => {
    const climbed = drag(startSwipe(120), up(FINE_DP_PER_BPM * 2 - 1), SLOW);
    const shaken = drag(climbed, REVERSAL_DP - 1, SLOW);
    expect(drag(shaken, up(REVERSAL_DP), SLOW).bpm).toBe(122);
  });

  it('does not change the tempo when the finger lifts, however fast it was', () => {
    const dragged = drag(startSwipe(120), up(FINE_DP_PER_BPM * 3), FAST);
    const lifted = swipeTempo(dragged, dragged.translationY, -FAST, BOUNDS);
    expect(lifted).toEqual(dragged);
  });
});

describe('clampBpm', () => {
  it('holds a tempo inside the range and pins one outside it', () => {
    expect(clampBpm(120, BOUNDS)).toBe(120);
    expect(clampBpm(1, BOUNDS)).toBe(BOUNDS.min);
    expect(clampBpm(10000, BOUNDS)).toBe(BOUNDS.max);
  });
});

describe('useTempoSwipe', () => {
  it('has no release handler that could move the tempo', () => {
    const hook = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        '../screen/useTempoSwipe.ts',
      ),
      'utf8',
    );
    expect(hook).not.toMatch(/\.on(End|Finalize|TouchesUp)\(/);
    expect(hook).toMatch(/\.onUpdate\(/);
  });
});
