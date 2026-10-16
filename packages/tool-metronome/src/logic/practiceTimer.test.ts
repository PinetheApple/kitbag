import { describe, expect, it } from 'vitest';

import { formatPracticeElapsed, hasPracticeToReset } from './practiceTimer.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('formatPracticeElapsed', () => {
  it('reads mm:ss for a session under an hour', () => {
    expect(formatPracticeElapsed(12 * MINUTE + 4 * SECOND)).toBe('12:04');
    expect(formatPracticeElapsed(0)).toBe('0:00');
  });

  it('grows an hours field rather than counting past 59 minutes', () => {
    expect(formatPracticeElapsed(HOUR + 2 * MINUTE + 3 * SECOND)).toBe(
      '1:02:03',
    );
  });

  it('floors a part-second instead of rounding a session up', () => {
    expect(formatPracticeElapsed(1999)).toBe('0:01');
  });
});

describe('hasPracticeToReset', () => {
  it('hides reset while the pill reads 0:00', () => {
    expect(hasPracticeToReset(0)).toBe(false);
    expect(hasPracticeToReset(SECOND - 1)).toBe(false);
  });

  it('offers reset from the first second the pill shows', () => {
    expect(hasPracticeToReset(SECOND)).toBe(true);
    expect(hasPracticeToReset(HOUR)).toBe(true);
  });
});
