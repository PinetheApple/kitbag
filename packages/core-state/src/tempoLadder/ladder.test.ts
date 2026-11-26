import { BPM_LOOKUP_SOURCE } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import getSongBpmSearch from './fixtures/getsongbpm-search.json';
import noResult from './fixtures/getsongbpm-no-result.json';
import { fakeHttp, GETSONGBPM_SEARCH, offline } from './http.test-helper.ts';
import { LOOKUP_TIMEOUT_MS } from './http.ts';
import { climbLadder } from './ladder.ts';
import { ladderRuntime, memoryCache } from './ladder.test-helper.ts';
import { songRow } from './libraryRows.test-helper.ts';
import { BPM_SOURCE } from './sources.ts';
import type { OnlineBpmLookup } from './onlineBpmLookup.ts';

const SONG = { title: 'Under Pressure', artist: 'Queen' };
const KEY = 'test-key';
const ONLINE_HIT = { [GETSONGBPM_SEARCH]: getSongBpmSearch };

afterEach(() => {
  vi.useRealTimers();
});

function answering(
  name: string,
  bpm: number | null,
  asked: string[],
): OnlineBpmLookup {
  return {
    id: BPM_LOOKUP_SOURCE.getSongBpm,
    lookUp: () => {
      asked.push(name);
      return Promise.resolve(bpm);
    },
  };
}

const hung: OnlineBpmLookup = {
  id: BPM_LOOKUP_SOURCE.getSongBpm,
  lookUp: () => new Promise<never>(() => undefined),
};

describe('climbLadder', () => {
  it('takes an analysed library song before going online', async () => {
    const http = fakeHttp(ONLINE_HIT);
    const { cache, puts } = memoryCache();
    const result = await climbLadder(
      SONG,
      ladderRuntime({
        cache,
        rows: [songRow({ id: 4 })],
        httpGet: http.httpGet,
        key: KEY,
      }),
    );
    expect(result).toEqual({
      bpm: 113,
      source: BPM_SOURCE.library,
      tried: [BPM_SOURCE.library],
      libraryMatch: { kind: 'song', id: 4, bpm: 113 },
    });
    expect(http.urls).toEqual([]);
    expect(puts).toEqual([]);
  });

  it('prefers a library song to a cached lookup', async () => {
    const { cache } = memoryCache({
      bpm: 57,
      source: BPM_LOOKUP_SOURCE.getSongBpm,
    });
    const result = await climbLadder(
      SONG,
      ladderRuntime({ cache, rows: [songRow({ id: 4 })], key: KEY }),
    );
    expect(result).toMatchObject({ bpm: 113, source: BPM_SOURCE.library });
  });

  it('answers from the cache without going online', async () => {
    const http = fakeHttp(ONLINE_HIT);
    const { cache } = memoryCache({
      bpm: 114,
      source: BPM_LOOKUP_SOURCE.getSongBpm,
    });
    const result = await climbLadder(
      SONG,
      ladderRuntime({ cache, httpGet: http.httpGet, key: KEY }),
    );
    expect(result).toMatchObject({ bpm: 114, source: BPM_SOURCE.getSongBpm });
    expect(http.urls).toEqual([]);
  });

  it("asks GetSongBPM with the user's key and caches what it finds", async () => {
    const { cache, puts } = memoryCache();
    const result = await climbLadder(
      SONG,
      ladderRuntime({ cache, httpGet: fakeHttp(ONLINE_HIT).httpGet, key: KEY }),
    );
    expect(result).toEqual({
      bpm: 114,
      source: BPM_SOURCE.getSongBpm,
      tried: [BPM_SOURCE.library, BPM_SOURCE.getSongBpm],
      libraryMatch: null,
    });
    expect(puts).toEqual([[SONG, { bpm: 114, source: BPM_SOURCE.getSongBpm }]]);
  });

  it("goes online nowhere without the user's key", async () => {
    const http = fakeHttp(ONLINE_HIT);
    const result = await climbLadder(
      SONG,
      ladderRuntime({ httpGet: http.httpGet }),
    );
    expect(result.tried).toEqual([BPM_SOURCE.library]);
    expect(http.urls).toEqual([]);
  });

  it('caches no miss', async () => {
    const { cache, puts } = memoryCache();
    const result = await climbLadder(
      SONG,
      ladderRuntime({
        cache,
        httpGet: fakeHttp({ [GETSONGBPM_SEARCH]: noResult }).httpGet,
        key: KEY,
      }),
    );
    expect(result.bpm).toBeNull();
    expect(puts).toEqual([]);
  });

  it('asks the online lookups in the order given', async () => {
    const asked: string[] = [];
    const lookups = [
      answering('first', null, asked),
      answering('second', 98, asked),
    ];
    const result = await climbLadder(SONG, ladderRuntime({ lookups }));
    expect(asked).toEqual(['first', 'second']);
    expect(result.bpm).toBe(98);
  });

  it('counts a lookup that never answers as tried once and moves on', async () => {
    vi.useFakeTimers();
    const asked: string[] = [];
    const lookups = [hung, answering('next', 114, asked)];
    const pending = climbLadder(SONG, ladderRuntime({ lookups }));
    await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS);
    expect(await pending).toEqual({
      bpm: 114,
      source: BPM_SOURCE.getSongBpm,
      tried: [BPM_SOURCE.library, BPM_SOURCE.getSongBpm],
      libraryMatch: null,
    });
  });

  it('keeps climbing when the online lookups cannot be listed', async () => {
    const runtime = {
      ...ladderRuntime({ key: KEY }),
      onlineLookups: () => {
        throw new Error('no key store');
      },
    };
    expect(await climbLadder(SONG, runtime)).toEqual({
      bpm: null,
      source: null,
      tried: [BPM_SOURCE.library],
      libraryMatch: null,
    });
  });

  it('names every source tried when all of them fail', async () => {
    const failing = {
      get: () => Promise.reject(new Error('disk')),
      put: () => Promise.reject(new Error('disk')),
    };
    const runtime = {
      ...ladderRuntime({ cache: failing, httpGet: offline, key: KEY }),
      library: { list: () => Promise.reject(new Error('disk')) },
    };
    expect(await climbLadder(SONG, runtime)).toEqual({
      bpm: null,
      source: null,
      tried: [BPM_SOURCE.library, BPM_SOURCE.getSongBpm],
      libraryMatch: null,
    });
  });

  it('keeps a found tempo when the cache cannot store it', async () => {
    const failing = {
      get: () => Promise.resolve(null),
      put: () => Promise.reject(new Error('disk')),
    };
    const result = await climbLadder(
      SONG,
      ladderRuntime({
        cache: failing,
        httpGet: fakeHttp(ONLINE_HIT).httpGet,
        key: KEY,
      }),
    );
    expect(result.bpm).toBe(114);
  });

  it('looks nothing up for a track with no title', async () => {
    const http = fakeHttp(ONLINE_HIT);
    const result = await climbLadder(
      { title: '  ', artist: 'Queen' },
      ladderRuntime({ rows: [songRow()], httpGet: http.httpGet, key: KEY }),
    );
    expect(result).toEqual({
      bpm: null,
      source: null,
      tried: [],
      libraryMatch: null,
    });
    expect(http.urls).toEqual([]);
  });
});
