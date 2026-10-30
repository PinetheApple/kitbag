import { describe, expect, it, vi } from 'vitest';

import { collapseFaderOnBack } from './faderBack.ts';

describe('collapseFaderOnBack', () => {
  it('collapses an open fader and consumes the back press', () => {
    const collapse = vi.fn();
    expect(collapseFaderOnBack(true, collapse)).toBe(true);
    expect(collapse).toHaveBeenCalledOnce();
  });

  it('leaves back to the screen when no fader is open', () => {
    const collapse = vi.fn();
    expect(collapseFaderOnBack(false, collapse)).toBe(false);
    expect(collapse).not.toHaveBeenCalled();
  });
});
