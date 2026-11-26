import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { sourceRows } from './sourceRows.ts';

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

const podcast = session('Pocket Casts', { playing: true, spokenWord: true });
const paused = session('YT Music', { title: 'Bohemian Rhapsody' });
const playing = session('Spotify', { playing: true, title: 'Blinding Lights' });

describe('sourceRows', () => {
  it('lists playing music, then paused music, then spoken word', () => {
    const rows = sourceRows([podcast, paused, playing], undefined);
    expect(rows.map((row) => row.sessionId)).toEqual([
      'Spotify',
      'YT Music',
      'Pocket Casts',
    ]);
  });

  it('keeps the reported order within a rank', () => {
    const other = session('Other', { playing: true });
    const rows = sourceRows([other, playing], undefined);
    expect(rows.map((row) => row.sessionId)).toEqual(['Other', 'Spotify']);
  });

  it('names the state and title of music, and says spoken word is never picked for you', () => {
    const rows = sourceRows([podcast, paused, playing], undefined);
    expect(rows.map((row) => row.detail)).toEqual([
      'Playing · Blinding Lights',
      'Paused · Bohemian Rhapsody',
      'Podcast · playing · not picked for you',
    ]);
  });

  it('draws spoken word with the podcast glyph', () => {
    const rows = sourceRows([podcast, playing], undefined);
    expect(rows.map((row) => row.icon)).toEqual(['song', 'spokenAudio']);
  });

  it('puts the live dot only on music that is playing', () => {
    const rows = sourceRows([podcast, paused, playing], undefined);
    expect(rows.map((row) => row.live)).toEqual([true, false, false]);
  });

  it('marks only the followed session', () => {
    const rows = sourceRows([playing, paused], 'YT Music');
    expect(rows.map((row) => row.followed)).toEqual([false, true]);
  });

  it('leaves out a title the player did not report', () => {
    const [row] = sourceRows([session('Bare', { playing: true })], undefined);
    expect(row?.detail).toBe('Playing');
  });
});
