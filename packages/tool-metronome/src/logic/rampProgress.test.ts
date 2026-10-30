import { KB_RAMP_UNIT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { rampProgressFill } from './rampProgress.ts';

const { KB_RAMP_BARS, KB_RAMP_SECONDS, KB_RAMP_MINUTES } = KB_RAMP_UNIT;

describe('rampProgressFill', () => {
  it('follows the engine progress with motion allowed', () => {
    expect(rampProgressFill(0.37, 4, KB_RAMP_BARS, false)).toBe(0.37);
    expect(rampProgressFill(1.4, 4, KB_RAMP_BARS, false)).toBe(1);
  });

  it('holds a one-bar step empty until the bar completes', () => {
    for (const progress of [0, 0.3, 0.99]) {
      expect(rampProgressFill(progress, 1, KB_RAMP_BARS, true)).toBe(0);
    }
    expect(rampProgressFill(1, 1, KB_RAMP_BARS, true)).toBe(1);
  });

  it('steps a bar interval in whole bars', () => {
    expect(rampProgressFill(0.2, 4, KB_RAMP_BARS, true)).toBe(0);
    expect(rampProgressFill(0.3, 4, KB_RAMP_BARS, true)).toBe(0.25);
    expect(rampProgressFill(0.74, 4, KB_RAMP_BARS, true)).toBe(0.5);
  });

  it('steps a seconds interval in whole seconds', () => {
    expect(rampProgressFill(0.15, 10, KB_RAMP_SECONDS, true)).toBe(0.1);
    expect(rampProgressFill(0.19, 10, KB_RAMP_SECONDS, true)).toBe(0.1);
  });

  it('steps a minutes interval in the tenths its countdown shows', () => {
    expect(rampProgressFill(0.06, 1, KB_RAMP_MINUTES, true)).toBe(0);
    expect(rampProgressFill(0.14, 1, KB_RAMP_MINUTES, true)).toBe(0.1);
  });
});
