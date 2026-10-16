import { describe, expect, it } from 'vitest';

import { tempoArrowDelta } from './tempoArrows.ts';

// SPEC §5.2's swipe step, stated as a number so retuning the constant fails.
const SPEC_STEP_BPM = 1;

describe('tempoArrowDelta', () => {
  it('raises the tempo one step on ▲', () => {
    expect(tempoArrowDelta('up')).toBe(SPEC_STEP_BPM);
  });

  it('lowers the tempo one step on ▼', () => {
    expect(tempoArrowDelta('down')).toBe(-SPEC_STEP_BPM);
  });
});
