import { describe, expect, it } from 'vitest';

import { formatClockSeconds } from './text.ts';

describe('formatClockSeconds', () => {
  it.each([
    [0, '0:00'],
    [-3, '0:00'],
    [59.9, '0:59'],
    [81, '1:21'],
    [311, '5:11'],
    [3723, '1:02:03'],
  ])('%s s reads %s', (seconds, text) => {
    expect(formatClockSeconds(seconds)).toBe(text);
  });
});
