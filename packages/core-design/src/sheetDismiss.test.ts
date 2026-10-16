import { describe, expect, it } from 'vitest';

import {
  SHEET_DISMISS_DRAG_FRACTION,
  shouldDismissSheet,
} from './sheetDismiss.ts';

const HEIGHT = 400;
const THRESHOLD = HEIGHT * SHEET_DISMISS_DRAG_FRACTION;

describe('shouldDismissSheet', () => {
  it('dismisses once the drag passes the fraction of the sheet height', () => {
    expect(shouldDismissSheet(THRESHOLD + 1, HEIGHT)).toBe(true);
  });

  it('springs back at or below the threshold and for upward drags', () => {
    expect(shouldDismissSheet(THRESHOLD, HEIGHT)).toBe(false);
    expect(shouldDismissSheet(-THRESHOLD * 2, HEIGHT)).toBe(false);
  });

  it('never dismisses before the sheet has been measured', () => {
    expect(shouldDismissSheet(1, 0)).toBe(false);
    expect(shouldDismissSheet(HEIGHT, 0)).toBe(false);
  });
});
