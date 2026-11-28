import { describe, expect, it } from 'vitest';

import { gridBeatsToOne, oneFromTap } from './tapDownbeat.ts';

const FOUR = 4;
const DRIFTING_BEATS = [0, 0.5, 1.02, 1.56, 2.12, 2.7, 3.3, 3.92, 4.56];
const DOWNBEATS = [0, 4, 8];
const ON_BEAT_SEVEN_SEC = 3.92;
const BEAT_SEC = 0.5;

describe('gridBeatsToOne', () => {
  it('snaps to the drifting grid beat, not a constant beat from the first downbeat', () => {
    const constantGuess = Math.round(ON_BEAT_SEVEN_SEC / BEAT_SEC) % FOUR;
    expect(constantGuess).toBe(0);
    expect(
      gridBeatsToOne(DRIFTING_BEATS, DOWNBEATS, ON_BEAT_SEVEN_SEC, FOUR),
    ).toBe(3);
  });

  it('counts from the bar the tap falls in', () => {
    expect(gridBeatsToOne(DRIFTING_BEATS, DOWNBEATS, 2.7, FOUR)).toBe(1);
  });

  it('counts from shifted downbeats', () => {
    expect(gridBeatsToOne(DRIFTING_BEATS, [1, 5], 2.7, FOUR)).toBe(0);
  });
});

describe('oneFromTap', () => {
  it('snaps a near tap to its beat and says how far the 1 moved', () => {
    expect(oneFromTap(1000, 500, 2040, FOUR)).toEqual({
      downbeatMs: 2000,
      movedBeats: 2,
    });
  });
});
