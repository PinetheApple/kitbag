import { describe, expect, it } from 'vitest';

import { sweepFill } from './barSweep.ts';

describe('sweepFill', () => {
  it('follows the bar phase with motion allowed', () => {
    expect(sweepFill(0.25, false)).toBe(0.25);
    expect(sweepFill(0.75, false)).toBe(0.75);
  });

  it('clamps a phase outside the bar', () => {
    expect(sweepFill(-0.1, false)).toBe(0);
    expect(sweepFill(1.2, false)).toBe(1);
  });

  it('holds still at every phase with reduce motion on', () => {
    for (const phase of [0, 0.25, 0.5, 0.99, 1]) {
      expect(sweepFill(phase, true)).toBe(0);
    }
  });
});
