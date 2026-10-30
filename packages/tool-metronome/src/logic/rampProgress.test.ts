import { KB_RAMP_UNIT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { rampProgressFill, rampTrackShown } from './rampProgress.ts';
import { rampRemainingText } from './statusRows.ts';

const { KB_RAMP_BARS, KB_RAMP_SECONDS, KB_RAMP_MINUTES } = KB_RAMP_UNIT;
const SAMPLES_PER_STEP = 997;

describe('rampProgressFill', () => {
  it('follows the engine progress with motion allowed', () => {
    expect(rampProgressFill(0.37, 2.5, 4, KB_RAMP_BARS, false)).toBe(0.37);
    expect(rampProgressFill(1.4, 0, 4, KB_RAMP_BARS, false)).toBe(1);
  });

  it('steps a bar interval in whole bars', () => {
    expect(rampProgressFill(0.2, 4, 4, KB_RAMP_BARS, true)).toBe(0);
    expect(rampProgressFill(0.3, 3, 4, KB_RAMP_BARS, true)).toBe(0.25);
    expect(rampProgressFill(0.74, 2, 4, KB_RAMP_BARS, true)).toBe(0.5);
  });

  it('steps a fractional seconds interval on the countdown ticks', () => {
    expect(rampProgressFill(0.1, 2.25, 2.5, KB_RAMP_SECONDS, true)).toBe(0);
    expect(rampProgressFill(0.3, 1.75, 2.5, KB_RAMP_SECONDS, true)).toBeCloseTo(
      0.2,
    );
    expect(rampProgressFill(0.7, 0.75, 2.5, KB_RAMP_SECONDS, true)).toBeCloseTo(
      0.6,
    );
  });

  it('holds a sub-tick minutes interval empty for its whole step', () => {
    for (const remaining of [0.05, 0.03, 0.001]) {
      expect(
        rampProgressFill(0.5, remaining, 0.05, KB_RAMP_MINUTES, true),
      ).toBe(0);
    }
  });

  it.each([
    ['bars', KB_RAMP_BARS, 4, true],
    ['whole seconds', KB_RAMP_SECONDS, 10, false],
    ['fractional seconds', KB_RAMP_SECONDS, 2.5, false],
    ['minutes', KB_RAMP_MINUTES, 1, false],
    ['fractional minutes', KB_RAMP_MINUTES, 0.25, false],
  ])(
    'changes exactly when the countdown text changes (%s)',
    (_name, unit, interval, wholeRemaining) => {
      let lastText = '';
      let lastFill = Number.NaN;
      for (let i = 0; i <= SAMPLES_PER_STEP; i++) {
        const elapsed = (interval * i) / SAMPLES_PER_STEP;
        const left = interval - elapsed;
        const remaining = wholeRemaining ? Math.ceil(left) : left;
        const text = rampRemainingText(remaining, unit);
        const fill = rampProgressFill(
          elapsed / interval,
          remaining,
          interval,
          unit,
          true,
        );
        if (i > 0) expect(fill !== lastFill).toBe(text !== lastText);
        lastText = text;
        lastFill = fill;
      }
    },
  );
});

describe('rampTrackShown', () => {
  it('always shows the track with motion allowed', () => {
    expect(rampTrackShown(1, KB_RAMP_BARS, false)).toBe(true);
  });

  it('hides a single-tick step under reduce motion, which never fills', () => {
    expect(rampTrackShown(1, KB_RAMP_BARS, true)).toBe(false);
    expect(rampTrackShown(1, KB_RAMP_SECONDS, true)).toBe(false);
    expect(rampTrackShown(0.05, KB_RAMP_MINUTES, true)).toBe(false);
  });

  it('shows a multi-tick step under reduce motion', () => {
    expect(rampTrackShown(2, KB_RAMP_BARS, true)).toBe(true);
    expect(rampTrackShown(2.5, KB_RAMP_SECONDS, true)).toBe(true);
    expect(rampTrackShown(0.2, KB_RAMP_MINUTES, true)).toBe(true);
  });
});
