import { describe, expect, it } from 'vitest';

import {
  appActivityFromState,
  permissionFromRequest,
} from './micPermission.ts';

const RESULTS = {
  GRANTED: 'granted',
  DENIED: 'denied',
  NEVER_ASK_AGAIN: 'never_ask_again',
};

describe('permissionFromRequest', () => {
  it('maps never_ask_again to blocked so the screen offers Settings', () => {
    expect(permissionFromRequest('never_ask_again', RESULTS)).toBe('blocked');
  });

  it('maps grant and denial', () => {
    expect(permissionFromRequest('granted', RESULTS)).toBe('granted');
    expect(permissionFromRequest('denied', RESULTS)).toBe('denied');
  });
});

describe('appActivityFromState', () => {
  it('forwards active and background only', () => {
    expect(appActivityFromState('active')).toBe('active');
    expect(appActivityFromState('background')).toBe('background');
    expect(appActivityFromState('inactive')).toBeUndefined();
    expect(appActivityFromState('unknown')).toBeUndefined();
  });
});
