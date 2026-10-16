import { describe, expect, it } from 'vitest';

import {
  decayNeedle,
  NEEDLE_RETURN_FACTOR,
  NEEDLE_RETURN_STEP_MS,
  NO_DISPLAYED_CENTS,
  smoothCents,
} from './needle.ts';

describe('smoothCents (D2)', () => {
  it('shows the first hop after a clear as-is', () => {
    expect(smoothCents(NO_DISPLAYED_CENTS, -12)).toBe(-12);
  });

  it('averages each new hop 0.5/0.5 with the previous displayed value', () => {
    let shown = smoothCents(NO_DISPLAYED_CENTS, 20);
    shown = smoothCents(shown, 0);
    expect(shown).toBe(10);
    shown = smoothCents(shown, 0);
    expect(shown).toBe(5);
    shown = smoothCents(shown, -10);
    expect(shown).toBe(-2.5);
  });

  it('starts over after a reset rather than averaging with the old note', () => {
    const before = smoothCents(smoothCents(NO_DISPLAYED_CENTS, 40), 40);
    expect(before).toBe(40);
    expect(smoothCents(NO_DISPLAYED_CENTS, -6)).toBe(-6);
  });

  it('keeps the displayed value when a hop carries no finite error', () => {
    expect(smoothCents(8, Number.NaN)).toBe(8);
  });
});

const RETURN_95_MS = 225;
const STEPS_MS = [1, 4, 1000 / 120, NEEDLE_RETURN_STEP_MS, 1000 / 30, 45, 225];

// Runs the decay over `totalMs` in equal frames of `stepMs` (last one short).
function decayOver(start: number, totalMs: number, stepMs: number): number {
  let value = start;
  let left = totalMs;
  while (left > 0) {
    const dt = Math.min(stepMs, left);
    value = decayNeedle(value, dt, false);
    left -= dt;
  }
  return value;
}

describe('decayNeedle (D4)', () => {
  it('multiplies by 0.8 per 1/60 s', () => {
    expect(NEEDLE_RETURN_FACTOR).toBe(0.8);
    expect(decayNeedle(0.5, NEEDLE_RETURN_STEP_MS, false)).toBeCloseTo(0.4, 12);
  });

  it('leaves about 5 % after 225 ms whatever the frame size', () => {
    for (const step of STEPS_MS) {
      const left = decayOver(0.8, RETURN_95_MS, step) / 0.8;
      expect(left, `step ${String(step)} ms`).toBeCloseTo(0.0494, 3);
    }
  });

  it('decays from either side toward the centre, never past it', () => {
    const fromLeft = decayOver(-0.6, 100, NEEDLE_RETURN_STEP_MS);
    expect(fromLeft).toBeLessThan(0);
    expect(fromLeft).toBeGreaterThan(-0.6);
  });

  it('reaches the centre within tolerance', () => {
    for (const step of STEPS_MS) {
      expect(Math.abs(decayOver(0.8, 1000, step))).toBeLessThan(1e-4);
    }
  });

  it('jumps to the centre under reduced motion', () => {
    expect(decayNeedle(0.7, 16, true)).toBe(0);
  });

  it('holds still on a zero or negative interval, and parks a bad value', () => {
    expect(decayNeedle(0.3, 0, false)).toBe(0.3);
    expect(decayNeedle(0.3, -5, false)).toBe(0.3);
    expect(decayNeedle(Number.NaN, 16, false)).toBe(0);
  });
});
