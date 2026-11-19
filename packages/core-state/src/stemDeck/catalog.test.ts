import { describe, expect, it } from 'vitest';

import {
  markInLibrary,
  parseHealth,
  parseJobs,
  parseSetlists,
  selectableIds,
  setlistSongs,
  visibleSongs,
  type Catalog,
} from './catalog.ts';
import { HEALTH, job, JOBS, SETLISTS } from './store.test-helper.ts';

const A = 'a'.repeat(12);
const B = 'b'.repeat(12);

describe('parseHealth', () => {
  it('knows StemDeck by name and reads its version', () => {
    expect(parseHealth(HEALTH)).toEqual({ isStemDeck: true, version: '2.4.0' });
  });

  it.each([
    ['another server', JSON.stringify({ name: 'Jellyfin', version: '10' })],
    ['an array', '[]'],
    ['malformed JSON', '{"name":"StemDeck"'],
    ['an HTML page', '<html>StemDeck</html>'],
    ['nothing', ''],
  ])('refuses %s', (_, body) => {
    expect(parseHealth(body).isStemDeck).toBe(false);
  });
});

describe('parseJobs', () => {
  it('lists finished songs with their lanes and counts unavailable ones', () => {
    const parsed = parseJobs(JOBS);
    expect(parsed?.unavailable).toBe(1);
    expect(parsed?.songs).toEqual([
      {
        jobId: A,
        title: 'Way Maker',
        artist: 'Sinach',
        durationSec: 481,
        lanes: ['vocals', 'drums', 'bass'],
        inLibrary: false,
        sameSong: null,
      },
      expect.objectContaining({ jobId: B, title: 'Gratitude' }),
    ]);
  });

  it('falls back to the job id for a missing title and skips unusable entries', () => {
    const parsed = parseJobs(
      JSON.stringify([
        { ...job('a', ''), title: null, display_artist: null, duration: null },
        { status: 'done' },
        'nonsense',
        { ...job('b', 'Running'), status: 'running' },
        { ...job('c', 'No stems'), stems: [] },
      ]),
    );
    expect(
      parsed?.songs.map((s) => [s.title, s.artist, s.durationSec]),
    ).toEqual([[A, null, null]]);
    expect(parsed?.unavailable).toBe(1);
  });

  it('reads malformed JSON as unreadable', () => {
    expect(parseJobs('{"oops"')).toBeNull();
    expect(parseJobs('{}')).toBeNull();
  });
});

describe('the song list', () => {
  const parsed = parseJobs(JOBS);
  const catalog: Catalog = {
    songs: markInLibrary(parsed?.songs ?? [], new Set([A])),
    setlists: parseSetlists(SETLISTS),
    unavailable: 1,
  };

  it('marks songs already in the library and leaves them out of select all', () => {
    expect(catalog.songs.map((s) => s.inLibrary)).toEqual([true, false]);
    expect(selectableIds(catalog.songs)).toEqual([B]);
  });

  it('filters by setlist without reordering, and by title or artist', () => {
    expect(setlistSongs(catalog, 's1').map((s) => s.jobId)).toEqual([B]);
    expect(setlistSongs(catalog, null)).toHaveLength(2);
    expect(setlistSongs(catalog, 'gone')).toHaveLength(2);
    expect(visibleSongs(catalog, null, 'way').map((s) => s.jobId)).toEqual([A]);
    expect(visibleSongs(catalog, null, 'SINACH')).toHaveLength(2);
    expect(visibleSongs(catalog, 's1', 'way')).toEqual([]);
  });

  it('drops malformed setlists', () => {
    expect(
      parseSetlists(JSON.stringify([{ id: 'x' }, { id: 'y', name: 'Set' }])),
    ).toEqual([{ id: 'y', name: 'Set', songIds: [] }]);
    expect(parseSetlists('nope')).toEqual([]);
  });
});
