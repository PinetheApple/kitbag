import { songPlayer } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import { steppedEdge } from './loopHandles.ts';

const BEATS = [0.5, 1.0, 1.5, 2.0, 2.5];
const LOOP = { startSec: 1.0, endSec: 2.0 };

describe('a loop edge stepped from a screen reader', () => {
  it('moves the edge to the next or previous beat', () => {
    expect(steppedEdge(LOOP, 'start', -1, BEATS)).toBe(0.5);
    expect(steppedEdge(LOOP, 'end', 1, BEATS)).toBe(2.5);
  });

  it('moves a gridless edge by the fixed step', () => {
    expect(steppedEdge(LOOP, 'end', 1, [])).toBe(
      LOOP.endSec + songPlayer.loopNudgeSec,
    );
    expect(steppedEdge(LOOP, 'start', -1, [])).toBe(
      LOOP.startSec - songPlayer.loopNudgeSec,
    );
  });
});
