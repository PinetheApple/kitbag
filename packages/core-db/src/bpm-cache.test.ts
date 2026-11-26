import { afterEach, describe, expect, it } from 'vitest';

import {
  BPM_CACHE_TTL_MS,
  createBpmCacheRepository,
} from './bpm-cache-repository';
import { BPM_LOOKUP_SOURCE } from './bpm-lookup-source';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

const START_MS = Date.UTC(2026, 10, 1);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  const clock = { nowMs: START_MS };
  const cache = createBpmCacheRepository(handle, () => new Date(clock.nowMs));
  return { cache, clock, connection: handle.connection };
}

const SONG = { title: 'Under Pressure', artist: 'Queen & David Bowie' };
const HIT = { bpm: 113.5, source: BPM_LOOKUP_SOURCE.getSongBpm };

describe('bpm cache', () => {
  it('has nothing for a song never looked up', async () => {
    const { cache } = setup();
    expect(await cache.get(SONG)).toBeNull();
  });

  it('answers a song written differently from the same entry', async () => {
    const { cache } = setup();
    await cache.put(SONG, HIT);
    expect(
      await cache.get({
        title: 'UNDER PRESSURE (Remastered 2011)',
        artist: 'queen & david bowie',
      }),
    ).toEqual(HIT);
  });

  it('keeps an entry until its time limit and forgets it after', async () => {
    const { cache, clock } = setup();
    await cache.put(SONG, HIT);
    clock.nowMs = START_MS + BPM_CACHE_TTL_MS;
    expect(await cache.get(SONG)).toEqual(HIT);
    clock.nowMs = START_MS + BPM_CACHE_TTL_MS + 1000;
    expect(await cache.get(SONG)).toBeNull();
  });

  it('looks a song up again after a week', async () => {
    const { cache, clock } = setup();
    await cache.put(SONG, HIT);
    clock.nowMs = START_MS + WEEK_MS + 1;
    expect(await cache.get(SONG)).toBeNull();
  });

  it('replaces an entry instead of adding a second row', async () => {
    const { cache, clock, connection } = setup();
    await cache.put(SONG, HIT);
    clock.nowMs = START_MS + BPM_CACHE_TTL_MS;
    const newer = { ...HIT, bpm: 114 };
    await cache.put(SONG, newer);
    clock.nowMs = START_MS + BPM_CACHE_TTL_MS + 1000;
    expect(await cache.get(SONG)).toEqual(newer);
    expect(
      connection.prepare('SELECT COUNT(*) AS n FROM bpm_cache').get()?.n,
    ).toBe(1);
  });

  it('ignores an entry from a source it does not know', async () => {
    const { cache, connection } = setup();
    await cache.put(SONG, HIT);
    connection.exec("UPDATE bpm_cache SET source = 'acousticbrainz'");
    expect(await cache.get(SONG)).toBeNull();
  });
});
