import { describe, expect, it } from 'vitest';

import { countSquareState } from './countSquareState.ts';

describe('count-in squares', () => {
  it('marks counted, current and upcoming beats', () => {
    expect([0, 1, 2, 3].map((beat) => countSquareState(beat, 2))).toEqual([
      'done',
      'done',
      'now',
      'upcoming',
    ]);
  });
});
