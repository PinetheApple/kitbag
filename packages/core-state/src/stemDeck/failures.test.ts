import { describe, expect, it } from 'vitest';

import { nativeFailure } from './failures.ts';
import { CODES } from './store.test-helper.ts';

describe('nativeFailure', () => {
  it('maps every code native exports through its constant', () => {
    const exported = Object.entries(CODES)
      .filter(([key]) => key.startsWith('failure'))
      .map(([, code]) => code as string);
    expect(exported.map((code) => nativeFailure(code, CODES))).not.toContain(
      'unknown',
    );
  });

  it('reads the code by value, not by name', () => {
    const renamed = { ...CODES, failureDropped: 'E_DROPPED' };
    expect(nativeFailure('E_DROPPED', renamed)).toBe('dropped');
    expect(nativeFailure('dropped', renamed)).toBe('unknown');
  });

  it('reads no code as unknown', () => {
    expect(nativeFailure(null, CODES)).toBe('unknown');
  });
});
