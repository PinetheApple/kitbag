import { describe, expect, it } from 'vitest';

import { appActivityFromState } from './appActivity.ts';

describe('appActivityFromState', () => {
  it('forwards active and background only', () => {
    expect(appActivityFromState('active')).toBe('active');
    expect(appActivityFromState('background')).toBe('background');
    expect(appActivityFromState('inactive')).toBeUndefined();
    expect(appActivityFromState('unknown')).toBeUndefined();
  });
});
