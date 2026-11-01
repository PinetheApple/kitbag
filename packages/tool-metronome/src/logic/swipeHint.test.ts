import { describe, expect, it } from 'vitest';

import { showSwipeHint } from './swipeHint.ts';

const LAID_OUT_ZONE = 120;
const UNMEASURED_ZONE = 0;

describe('showSwipeHint', () => {
  it('shows when unseen, laid out and no summary is up', () => {
    expect(showSwipeHint(false, LAID_OUT_ZONE, false)).toBe(true);
  });

  it('waits while the practice summary shows', () => {
    expect(showSwipeHint(false, LAID_OUT_ZONE, true)).toBe(false);
  });

  it('waits for the tempo zone to lay out', () => {
    expect(showSwipeHint(false, UNMEASURED_ZONE, false)).toBe(false);
  });

  it('stays hidden once seen', () => {
    expect(showSwipeHint(true, LAID_OUT_ZONE, false)).toBe(false);
  });
});
