import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { chooseSession, orderSessions } from './chooseSession.ts';

function session(
  sessionId: string,
  overrides: Partial<MediaSessionSnapshot> = {},
): MediaSessionSnapshot {
  return {
    sessionId,
    packageName: sessionId,
    appLabel: sessionId,
    title: null,
    artist: null,
    durationMs: null,
    playing: false,
    positionMs: 0,
    positionUpdatedAtMs: 0,
    speed: 0,
    spokenWord: false,
    ...overrides,
  };
}

const paused = session('paused');
const playing = session('playing', { playing: true });
const otherPlaying = session('other', { playing: true });
const podcast = session('podcast', { playing: true, spokenWord: true });
const none = { chosenId: undefined, pickedId: undefined };

describe('chooseSession', () => {
  it('chooses the playing session over a paused one listed first', () => {
    expect(chooseSession([paused, playing], none)).toBe('playing');
  });

  it('chooses a paused session when nothing plays', () => {
    expect(chooseSession([paused], none)).toBe('paused');
  });

  it('never chooses a spoken-word session on its own, even when it plays', () => {
    expect(chooseSession([podcast, paused], none)).toBe('paused');
    expect(chooseSession([podcast], none)).toBeUndefined();
  });

  it('keeps a playing choice when another session starts playing', () => {
    const choice = { chosenId: 'playing', pickedId: undefined };
    expect(chooseSession([otherPlaying, playing], choice)).toBe('playing');
  });

  it('keeps a paused choice while nothing else plays', () => {
    const choice = { chosenId: 'paused', pickedId: undefined };
    expect(chooseSession([session('idle'), paused], choice)).toBe('paused');
  });

  it('moves off a paused choice when another session plays', () => {
    const choice = { chosenId: 'paused', pickedId: undefined };
    expect(chooseSession([paused, playing], choice)).toBe('playing');
  });

  it('moves on when the chosen session goes away', () => {
    const choice = { chosenId: 'gone', pickedId: undefined };
    expect(chooseSession([paused, playing], choice)).toBe('playing');
  });

  it('holds what the user picked, spoken word included', () => {
    const choice = { chosenId: 'playing', pickedId: 'podcast' };
    expect(chooseSession([playing, podcast], choice)).toBe('podcast');
  });

  it('chooses nothing when there are no sessions', () => {
    expect(chooseSession([], none)).toBeUndefined();
  });
});

describe('orderSessions', () => {
  it('lists playing sessions first and keeps the native order otherwise', () => {
    const idle = session('idle');
    const ordered = orderSessions([paused, playing, idle, podcast]);
    expect(ordered.map(({ sessionId }) => sessionId)).toEqual([
      'playing',
      'podcast',
      'paused',
      'idle',
    ]);
  });
});
