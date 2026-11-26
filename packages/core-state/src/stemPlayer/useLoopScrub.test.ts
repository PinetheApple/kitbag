import { describe, expect, it, vi } from 'vitest';

import { songLengthFact } from '../playOrder/stemSongText.ts';
import { secondsToFrames } from './time.ts';
import { useLoopScrub } from './useLoopScrub.ts';

vi.mock('react', () => ({ useCallback: <T>(callback: T) => callback }));

const RATE = 48_000;
const SONG_SECONDS = 149.6;
const DURATION_FRAMES = secondsToFrames(SONG_SECONDS, RATE);

const state = {
  durationFrames: DURATION_FRAMES,
  engineRate: RATE,
  loop: { kind: 'off' },
  loopFailure: null,
  scrub: vi.fn(),
  cancelScrub: vi.fn(),
  seek: vi.fn(),
} as const;

type Select = Parameters<typeof useLoopScrub>[0];
const useSelect: Select = (selector) => selector(state);

describe('the player total', () => {
  it('reads the length the song list shows', () => {
    const { total } = useLoopScrub(useSelect);
    expect(total).toBe('2:29');
    expect(total).toBe(songLengthFact({ durationSec: SONG_SECONDS }));
  });

  it('reads the same at the end of the song as the elapsed clock', () => {
    const { spokenPosition } = useLoopScrub(useSelect);
    expect(spokenPosition(SONG_SECONDS)).toBe('2:29 of 2:29');
  });
});
