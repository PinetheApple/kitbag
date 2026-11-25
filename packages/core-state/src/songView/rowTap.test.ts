import { describe, expect, it } from 'vitest';

import { ROW_TAP, rowTap } from './rowTap.ts';

const SHOWN = 3;
const OTHER = 4;

describe('a Songs or Stem songs row tap', () => {
  it('opens the shown song as it is', () => {
    expect(
      rowTap({ kind: 'song', id: SHOWN }, { kind: 'song', id: SHOWN }),
    ).toBe(ROW_TAP.asIs);
    expect(
      rowTap({ kind: 'stems', id: SHOWN }, { kind: 'stems', id: SHOWN }),
    ).toBe(ROW_TAP.asIs);
  });

  it('views any other song', () => {
    expect(
      rowTap({ kind: 'song', id: OTHER }, { kind: 'song', id: SHOWN }),
    ).toBe(ROW_TAP.view);
    expect(
      rowTap({ kind: 'stems', id: SHOWN }, { kind: 'song', id: SHOWN }),
    ).toBe(ROW_TAP.view);
  });

  it('views the song when nothing is shown', () => {
    expect(rowTap({ kind: 'song', id: SHOWN }, null)).toBe(ROW_TAP.view);
  });
});
