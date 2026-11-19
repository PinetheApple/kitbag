import { describe, expect, it } from 'vitest';

import { GRIDLESS_STEP_SECONDS, steppedEdge } from './loopHandles.ts';

const BEATS = [0.5, 1.0, 1.5, 2.0, 2.5];
const LOOP = { startSec: 1.0, endSec: 2.0 };

describe('a loop edge stepped from a screen reader', () => {
  it('moves the edge to the next or previous beat', () => {
    expect(steppedEdge(LOOP, 'start', -1, BEATS)).toBe(0.5);
    expect(steppedEdge(LOOP, 'end', 1, BEATS)).toBe(2.5);
  });

  it('skips a step with no beat that way on a gridded song', () => {
    expect(steppedEdge({ startSec: 0.5, endSec: 2.5 }, 'end', 1, BEATS)).toBe(
      null,
    );
    expect(
      steppedEdge({ startSec: 0.5, endSec: 2.5 }, 'start', -1, BEATS),
    ).toBe(null);
  });

  it('skips a step that would reach the other edge', () => {
    const short = { startSec: 1.0, endSec: 1.5 };
    expect(steppedEdge(short, 'start', 1, BEATS)).toBe(null);
    expect(steppedEdge(short, 'end', -1, BEATS)).toBe(null);
    expect(steppedEdge(short, 'start', 1, [])).toBe(null);
  });

  it('moves a gridless edge by the fixed step', () => {
    expect(steppedEdge(LOOP, 'end', 1, [])).toBe(
      LOOP.endSec + GRIDLESS_STEP_SECONDS,
    );
    expect(steppedEdge(LOOP, 'start', -1, [])).toBe(
      LOOP.startSec - GRIDLESS_STEP_SECONDS,
    );
  });
});
