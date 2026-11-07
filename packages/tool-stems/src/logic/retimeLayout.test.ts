import { stemPlayer, stemSections } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { overflows, pinnedLinesFit } from './retimeLayout.ts';

const CONTROLS_AT_2X = 370;
const CHROME = stemSections.retimeGap + stemPlayer.bodyGap;
// 106 px between line tops at 2.625 density, emulator at font scale 2.0.
const LINE_AT_2X = 40.4;
const TWO_LINES_AT_2X = 2 * LINE_AT_2X + 2 * stemSections.currentMargin;

const fits = (room: number, line = LINE_AT_2X) =>
  pinnedLinesFit(room + CONTROLS_AT_2X + CHROME, CONTROLS_AT_2X, line);

describe('overflows', () => {
  it('ignores a body nothing has measured', () => {
    expect(overflows(0, 900)).toBe(false);
  });

  it('ignores rounding, and counts anything past it', () => {
    expect(overflows(484, 484.5)).toBe(false);
    expect(overflows(484, 486)).toBe(true);
  });
});

describe('pinnedLinesFit', () => {
  it('pins exactly when two current lines and their margins fit', () => {
    expect(TWO_LINES_AT_2X).toBeCloseTo(92.8);
    expect(fits(TWO_LINES_AT_2X)).toBe(true);
    expect(fits(TWO_LINES_AT_2X - 1)).toBe(false);
  });

  it('pins at 360x800 and 2.0, with and without the note on its own row', () => {
    expect(fits(124)).toBe(true);
    expect(fits(98)).toBe(true);
  });

  it.each([2, 24, 49])('refuses %d dp of lines at 2.0', (room) => {
    expect(fits(room)).toBe(false);
  });

  it('asks for more room where a line renders taller', () => {
    expect(fits(124, 65)).toBe(false);
  });

  it('refuses controls too tall for the body, before any line is measured', () => {
    expect(pinnedLinesFit(324, CONTROLS_AT_2X, 0)).toBe(false);
    expect(fits(-1, 0)).toBe(false);
  });

  it('asks for no lines until one is measured', () => {
    expect(fits(0, 0)).toBe(true);
  });

  it('waits for the body and the controls', () => {
    expect(pinnedLinesFit(0, CONTROLS_AT_2X, LINE_AT_2X)).toBe(true);
    expect(pinnedLinesFit(324, 0, LINE_AT_2X)).toBe(true);
  });
});
