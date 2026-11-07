import { describe, expect, it, vi } from 'vitest';

import { tapOnce } from './tapOnce.ts';

describe('tapOnce', () => {
  it('fires as the finger lands and not again on release', () => {
    const tap = vi.fn();
    const pad = tapOnce(tap);
    pad.pressIn();
    expect(tap).toHaveBeenCalledOnce();
    pad.press();
    expect(tap).toHaveBeenCalledOnce();
  });

  it('fires on a press with no landing, as a screen reader activates', () => {
    const tap = vi.fn();
    tapOnce(tap).press();
    expect(tap).toHaveBeenCalledOnce();
  });

  it('counts a drag that never became a press, then the next landing', () => {
    const tap = vi.fn();
    const pad = tapOnce(tap);
    pad.pressIn();
    pad.pressIn();
    expect(tap).toHaveBeenCalledTimes(2);
  });
});
