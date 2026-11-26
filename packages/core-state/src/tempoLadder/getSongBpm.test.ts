import { BPM_LOOKUP_SOURCE } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import noResult from './fixtures/getsongbpm-no-result.json';
import numericTempo from './fixtures/getsongbpm-numeric-tempo.json';
import search from './fixtures/getsongbpm-search.json';
import { getSongBpmSource, getSongBpmUrl } from './getSongBpm.ts';
import { fakeHttp, GETSONGBPM_SEARCH } from './http.test-helper.ts';
import type { HttpGet } from './http.ts';

const SONG = { title: 'Under Pressure', artist: 'Queen' };
const KEY = 'test-key';
const SIGNAL = new AbortController().signal;

function lookUpGetSongBpm(
  song: { readonly title: string; readonly artist: string },
  key: string,
  httpGet: HttpGet,
) {
  return getSongBpmSource(key, httpGet).lookUp(song, SIGNAL);
}

describe('getSongBpmUrl', () => {
  it('sends the key and a song and artist lookup', () => {
    const url = new URL(
      getSongBpmUrl({ title: 'Don’t Stop', artist: 'A & B' }, KEY),
    );
    expect(url.searchParams.get('api_key')).toBe(KEY);
    expect(url.searchParams.get('type')).toBe('both');
    expect(url.searchParams.get('lookup')).toBe('song:Don’t Stop artist:A & B');
  });
});

describe('getSongBpmSource', () => {
  it('answers as GetSongBPM', () => {
    expect(getSongBpmSource(KEY, fakeHttp({}).httpGet).id).toBe(
      BPM_LOOKUP_SOURCE.getSongBpm,
    );
  });

  it('takes the tempo of the same song, written as text', async () => {
    const http = fakeHttp({ [GETSONGBPM_SEARCH]: search });
    expect(await lookUpGetSongBpm(SONG, KEY, http.httpGet)).toBe(114);
  });

  it('takes a tempo written as a number', async () => {
    const http = fakeHttp({ [GETSONGBPM_SEARCH]: numericTempo });
    expect(await lookUpGetSongBpm(SONG, KEY, http.httpGet)).toBe(114);
  });

  it('never reads a tempo off a different song', async () => {
    const http = fakeHttp({ [GETSONGBPM_SEARCH]: search });
    expect(
      await lookUpGetSongBpm(
        { title: 'Californication', artist: 'Red Hot Chili Peppers' },
        KEY,
        http.httpGet,
      ),
    ).toBeNull();
  });

  it('reads a no-result body as nothing found', async () => {
    const http = fakeHttp({ [GETSONGBPM_SEARCH]: noResult });
    expect(await lookUpGetSongBpm(SONG, KEY, http.httpGet)).toBeNull();
  });
});
