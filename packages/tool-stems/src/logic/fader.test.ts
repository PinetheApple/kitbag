import { describe, expect, it } from 'vitest';

import {
  FADER_ENDS,
  formatDb,
  fractionToGain,
  gainToFraction,
  isUnity,
} from './fader.ts';

describe('the dB fader taper', () => {
  it('runs from silence at the bottom to the mixer maximum of 2.0 at the top', () => {
    expect(fractionToGain(0)).toBe(0);
    expect(fractionToGain(1)).toBe(2);
    expect(formatDb(fractionToGain(0))).toBe('−∞ dB');
    expect(formatDb(fractionToGain(1))).toBe('+6 dB');
  });

  it('puts 0 dB at a travel that maps back to a gain of exactly 1.0', () => {
    const unity = gainToFraction(1);
    expect(fractionToGain(unity)).toBeCloseTo(1, 12);
    expect(formatDb(fractionToGain(unity))).toBe('0 dB');
    expect(unity).toBeGreaterThan(0.5);
    expect(unity).toBeLessThan(1);
  });

  it('clamps travel and gain outside their ranges', () => {
    expect(fractionToGain(-1)).toBe(0);
    expect(fractionToGain(2)).toBe(2);
    expect(gainToFraction(4)).toBe(1);
    expect(gainToFraction(-1)).toBe(0);
  });

  it('reads cuts with a minus sign', () => {
    expect(formatDb(0.5)).toBe('−6 dB');
  });
});

describe('fader labels', () => {
  it('marks the ends and knows unity when it rounds to 0 dB', () => {
    expect(FADER_ENDS).toEqual({ low: '−∞', high: '+6' });
    expect(isUnity(1.001)).toBe(true);
    expect(isUnity(0.9)).toBe(false);
  });

  it('reads −∞ below −60 dB, so no label outgrows the widest one', () => {
    expect(formatDb(0.0011)).toBe('−59.2 dB');
    expect(formatDb(0.0009)).toBe('−∞ dB');
    expect(formatDb(fractionToGain(0.01))).toBe('−∞ dB');
  });
});
