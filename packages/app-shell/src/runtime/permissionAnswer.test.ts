import { describe, expect, it } from 'vitest';

import { permissionFromRequest } from './permissionAnswer.ts';

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
