import { describe, expect, it } from 'vitest';

import {
  NO_PULSE,
  pulseInBeat,
  pulseMarkFit,
  soundingPulse,
} from './pulseMarks.ts';

const MARKS = { mark: 6, gap: 3, radius: 2 };

describe('pulse mark size', () => {
  it('keeps the drawn size while the marks fit under the dot', () => {
    expect(pulseMarkFit(4, 56, MARKS)).toEqual(MARKS);
  });

  it('shrinks marks and gaps together to the dot width', () => {
    const fit = pulseMarkFit(16, 56, MARKS);
    expect(16 * fit.mark + 15 * fit.gap).toBeCloseTo(56);
    expect(fit.mark / fit.gap).toBeCloseTo(MARKS.mark / MARKS.gap);
    expect(fit.radius).toBeLessThan(MARKS.radius);
  });

  it('shrinks four marks under a small dot', () => {
    const fit = pulseMarkFit(4, 29, MARKS);
    expect(4 * fit.mark + 3 * fit.gap).toBeCloseTo(29);
  });
});

describe('sounding pulse', () => {
  it('finds the pulse from the bar phase', () => {
    expect(soundingPulse(0.3, 4, 2, 1)).toBe(2);
    expect(soundingPulse(0.4, 4, 2, 1)).toBe(3);
  });

  it('lights nothing when the phase and the current beat disagree', () => {
    expect(soundingPulse(0.49, 4, 2, 2)).toBe(NO_PULSE);
  });

  it('lights nothing while stopped', () => {
    expect(soundingPulse(0, 4, 2, -1)).toBe(NO_PULSE);
  });

  it('places a bar pulse under its own beat', () => {
    expect(pulseInBeat(3, 1, 2)).toBe(1);
    expect(pulseInBeat(3, 0, 2)).toBe(NO_PULSE);
    expect(pulseInBeat(NO_PULSE, 0, 2)).toBe(NO_PULSE);
  });
});
