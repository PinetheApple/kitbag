import { describe, expect, it } from 'vitest';

import { appActivityFromState, currentAppActivity } from './appActivity.ts';

describe('appActivityFromState', () => {
  it('forwards active and background only', () => {
    expect(appActivityFromState('active')).toBe('active');
    expect(appActivityFromState('background')).toBe('background');
    expect(appActivityFromState('inactive')).toBeUndefined();
    expect(appActivityFromState('unknown')).toBeUndefined();
  });
});

describe('currentAppActivity', () => {
  it('counts only a known foreground as active', () => {
    expect(currentAppActivity('active')).toBe('active');
    expect(currentAppActivity('background')).toBe('background');
    expect(currentAppActivity('inactive')).toBe('background');
    expect(currentAppActivity('unknown')).toBe('background');
  });
});
