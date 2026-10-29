import { describe, expect, it } from 'vitest';

import { cleanName } from './names.ts';

describe('cleanName', () => {
  it('trims the name and refuses one with nothing left', () => {
    expect(cleanName('  Echo (live) ')).toBe('Echo (live)');
    expect(cleanName('')).toBeNull();
    expect(cleanName(' \t\n ')).toBeNull();
  });

  it('keeps a long name whole', () => {
    const long = 'Charity Gayle - Echo (In Jesus Name) [LIVE] '
      .repeat(4)
      .trim();
    expect(cleanName(long)).toBe(long);
  });
});
