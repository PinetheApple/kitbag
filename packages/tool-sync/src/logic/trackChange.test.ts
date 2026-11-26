import { describe, expect, it } from 'vitest';

import { endedByTrackChange } from './trackChange.ts';

const lock = {
  sessionId: 'spotify',
  track: { title: 'Blinding Lights', artist: 'The Weeknd', durationMs: null },
  downbeatSec: 0,
  bpm: 171,
  lockedAtBoottimeMs: 0,
};

const playing = {
  sessionId: 'spotify',
  title: 'Levitating',
  artist: 'Dua Lipa',
};

describe('endedByTrackChange', () => {
  it('names a lock the next song in the same app ended', () => {
    expect(endedByTrackChange(lock, playing)).toBe(true);
  });

  it('is not a track change when the same song still plays', () => {
    expect(endedByTrackChange(lock, { ...playing, ...lock.track })).toBe(false);
  });

  it('is not a track change when another app was picked', () => {
    expect(endedByTrackChange(lock, { ...playing, sessionId: 'yt' })).toBe(
      false,
    );
  });

  it('is not a track change when nothing plays or nothing was locked', () => {
    expect(endedByTrackChange(lock, undefined)).toBe(false);
    expect(endedByTrackChange(undefined, playing)).toBe(false);
  });
});
