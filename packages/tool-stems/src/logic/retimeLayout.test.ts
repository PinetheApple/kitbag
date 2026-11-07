import { stemPlayer, stemSections } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { controlsFit, overflows } from './retimeLayout.ts';

const CONTROLS_AT_2X = 370;

describe('overflows', () => {
  it('ignores a body nothing has measured', () => {
    expect(overflows(0, 900)).toBe(false);
  });

  it('ignores rounding, and counts anything past it', () => {
    expect(overflows(484, 484.5)).toBe(false);
    expect(overflows(484, 486)).toBe(true);
  });
});

describe('controlsFit', () => {
  it('keeps the pin at 360x800 and 2.0, where the lines are small', () => {
    expect(controlsFit(484, CONTROLS_AT_2X)).toBe(true);
  });

  it('refuses at 360x640 and 2.0, where the controls alone are too tall', () => {
    expect(controlsFit(324, CONTROLS_AT_2X)).toBe(false);
  });

  it('counts the gap above the controls and the padding under them', () => {
    const exact = CONTROLS_AT_2X + stemSections.retimeGap + stemPlayer.bodyGap;
    expect(controlsFit(exact, CONTROLS_AT_2X)).toBe(true);
    expect(controlsFit(exact - 1, CONTROLS_AT_2X)).toBe(false);
  });

  it('waits until both are measured', () => {
    expect(controlsFit(0, CONTROLS_AT_2X)).toBe(true);
    expect(controlsFit(324, 0)).toBe(true);
  });
});
