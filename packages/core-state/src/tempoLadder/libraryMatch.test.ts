import { TEMPO_CORRECTION } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { matchLibrary } from './libraryMatch.ts';
import { songRow, stemSetRow } from './libraryRows.test-helper.ts';

const PLAYING = { title: 'Under Pressure - Remastered 2011', artist: 'QUEEN' };

describe('matchLibrary', () => {
  it('finds the analysed song that is playing', () => {
    expect(matchLibrary(PLAYING, [songRow({ id: 3 })])).toEqual({
      kind: 'song',
      id: 3,
      bpm: 113,
    });
  });

  it("gives the tempo with the song's half- or double-time fix", () => {
    const row = songRow({
      bpm: 56.5,
      tempoCorrection: TEMPO_CORRECTION.double,
    });
    expect(matchLibrary(PLAYING, [row])?.bpm).toBe(113);
  });

  it('finds a stem song that carries an artist', () => {
    expect(matchLibrary(PLAYING, [stemSetRow({ id: 9 })])).toEqual({
      kind: 'stems',
      id: 9,
      bpm: 113,
    });
  });

  it('skips a song with no beat grid or no tempo', () => {
    expect(
      matchLibrary(PLAYING, [
        songRow({ hasGrid: false }),
        songRow({ bpm: null }),
      ]),
    ).toBeNull();
  });

  it('never offers a different song', () => {
    expect(
      matchLibrary(PLAYING, [
        songRow({ title: 'Under Pressure', artist: 'Karaoke Band' }),
        stemSetRow({ title: 'Radio Ga Ga' }),
        stemSetRow({ artist: null }),
      ]),
    ).toBeNull();
  });

  it.each([
    [
      'a featured artist in the title',
      'Under Pressure (feat. David Bowie)',
      'Queen',
    ],
    ['a short ft. tag in the title', 'Under Pressure ft. David Bowie', 'Queen'],
    [
      'a featured artist in the artist',
      'Under Pressure',
      'Queen feat. David Bowie',
    ],
    ['punctuation and case', 'UNDER, PRESSURE!', 'queen.'],
    ['a dashed remaster note', 'Under Pressure - Remastered', 'Queen'],
  ])('matches the playing track despite %s', (_, title, artist) => {
    expect(matchLibrary({ title, artist }, [songRow({ id: 4 })])?.id).toBe(4);
  });

  it('treats search wildcards in a title as text', () => {
    expect(
      matchLibrary({ title: '%', artist: 'Queen' }, [
        songRow({ title: 'Anything' }),
      ]),
    ).toBeNull();
  });

  it('prefers the closest of several matches', () => {
    const closest = songRow({ id: 2, artist: 'Queen' });
    const credited = songRow({ id: 1, artist: 'Queen, Someone Else' });
    expect(matchLibrary(PLAYING, [credited, closest])?.id).toBe(2);
  });
});
