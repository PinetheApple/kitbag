import { MS_PER_SECOND } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { msToNextWholeSecond } from './secondTicks.ts';

const SINCE_MS = 10_250;
const PART_MS = 300;

describe('msToNextWholeSecond', () => {
  it('waits for the next whole second counted from the start', () => {
    expect(msToNextWholeSecond(SINCE_MS, SINCE_MS + PART_MS)).toBe(
      MS_PER_SECOND - PART_MS,
    );
  });

  it('waits a full second when on a whole second', () => {
    expect(msToNextWholeSecond(SINCE_MS, SINCE_MS + MS_PER_SECOND)).toBe(
      MS_PER_SECOND,
    );
  });

  it('counts toward the start before it is reached', () => {
    expect(msToNextWholeSecond(SINCE_MS, SINCE_MS - PART_MS)).toBe(PART_MS);
  });
});
