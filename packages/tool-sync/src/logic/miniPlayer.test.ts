import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  lockedSubtext,
  lockedTitle,
  lockedToLine,
  progressPlan,
} from './miniPlayer.ts';
import { UNKNOWN_TITLE } from './nowPlaying.ts';

const NOW = 50_000;
const DURATION = 200_000;

function session(change: Partial<MediaSessionSnapshot> = {}): MediaSessionSnapshot {
  return {
    sessionId: 's',
    packageName: 'com.spotify.music',
    appLabel: 'Spotify',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    durationMs: DURATION,
    playing: true,
    positionMs: 40_000,
    positionUpdatedAtMs: NOW - 10_000,
    speed: 1,
    spokenWord: false,
    ...change,
  };
}

describe('progressPlan', () => {
  it('starts from where the song is now and runs to its end', () => {
    expect(progressPlan(session(), NOW)).toEqual({
      from: 0.25,
      msToEnd: 150_000,
    });
  });

  it('runs to the end at the playback speed', () => {
    expect(progressPlan(session({ speed: 2 }), NOW).msToEnd).toBe(70_000);
  });

  it('holds still while paused', () => {
    expect(
      progressPlan(session({ playing: false, positionMs: 50_000 }), NOW),
    ).toEqual({ from: 0.25, msToEnd: undefined });
  });

  it.each([
    ['no session', undefined],
    ['no length', session({ durationMs: null })],
    ['no position', session({ positionMs: null })],
  ])('draws nothing with %s', (_case, followed) => {
    expect(progressPlan(followed, NOW)).toEqual({ from: 0, msToEnd: undefined });
  });

  it('stops at the end of the song', () => {
    expect(progressPlan(session({ positionMs: DURATION }), NOW)).toEqual({
      from: 1,
      msToEnd: undefined,
    });
  });
});

describe('the locked mini-player text', () => {
  it('names the app the click is locked to', () => {
    expect(lockedToLine('Spotify')).toBe('Play along · locked to Spotify');
    expect(lockedSubtext('Spotify')).toBe('Locked · Spotify');
  });

  it('still says it is locked before the app is known', () => {
    expect(lockedToLine(undefined)).toBe('Play along · locked');
  });

  it('falls back to an unknown title', () => {
    expect(
      lockedTitle({ title: null, artist: null, durationMs: null }),
    ).toBe(UNKNOWN_TITLE);
  });
});
