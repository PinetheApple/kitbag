import { describe, expect, it } from 'vitest';

import { a4Label, effectiveA4, stepA4 } from './a4.ts';

const RANGE = { min: 415, max: 466, default: 440 };

describe('A4', () => {
  it('shows the engine default until the user picks one', () => {
    expect(effectiveA4(null, RANGE)).toBe(440);
    expect(effectiveA4(432, RANGE)).toBe(432);
    expect(a4Label(440)).toBe('A4 · 440 Hz');
  });

  it('steps in whole hertz inside the range', () => {
    expect(stepA4(440, 1, RANGE)).toBe(441);
    expect(stepA4(415, -1, RANGE)).toBe(415);
    expect(stepA4(466, 1, RANGE)).toBe(466);
  });
});
