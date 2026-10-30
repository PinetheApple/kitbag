import { describe, expect, it } from 'vitest';

import { rampStepSpoken, rampStepText } from './rampStep.ts';

describe('ramp step display', () => {
  it('signs the step with the ramp direction', () => {
    expect(rampStepText(1, 118, 103)).toBe('−1');
    expect(rampStepText(5, 100, 140)).toBe('+5');
    expect(rampStepText(5, 120, 120)).toBe('5');
  });

  it('says the direction to a screen reader', () => {
    expect(rampStepSpoken(1, 118, 103)).toBe('1 BPM down');
    expect(rampStepSpoken(5, 100, 140)).toBe('5 BPM up');
    expect(rampStepSpoken(5, 120, 120)).toBe('5 BPM');
  });
});
