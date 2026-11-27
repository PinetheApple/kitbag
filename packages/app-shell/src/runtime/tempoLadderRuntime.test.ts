import { BPM_LOOKUP_SOURCE } from '@kitbag/core-db';
import type { TempoLadderRuntime } from '@kitbag/core-state';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ladder = vi.hoisted(() => ({
  runtime: undefined as TempoLadderRuntime | undefined,
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  configureTempoLadder: (runtime: TempoLadderRuntime) => {
    ladder.runtime = runtime;
  },
}));

vi.mock('./database.ts', () => ({ getDatabase: () => ({}) }));

await import('./tempoLadderRuntime.ts');
const { getGetSongBpmKeyStore } = await import('@kitbag/core-state');

const SONG = { title: 'Blackbird', artist: 'The Beatles' };

function lookups() {
  if (ladder.runtime === undefined) throw new Error('ladder not configured');
  return ladder.runtime.onlineLookups();
}

async function askedUrl(): Promise<string> {
  const asked: string[] = [];
  const fetched = vi.fn((url: string) => {
    asked.push(url);
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ search: [] }),
    });
  });
  vi.stubGlobal('fetch', fetched);
  const [lookup] = lookups();
  await lookup?.lookUp(SONG, new AbortController().signal);
  return asked.join(' ');
}

afterEach(() => {
  vi.unstubAllGlobals();
  getGetSongBpmKeyStore().getState().removeKey();
});

describe('tempo ladder online rungs', () => {
  it('goes online nowhere without a key', () => {
    expect(lookups()).toEqual([]);
  });

  it('asks GetSongBPM with the key the user entered, and the new one after a change', async () => {
    getGetSongBpmKeyStore().getState().setKey('first-key');
    expect(lookups().map(({ id }) => id)).toEqual([
      BPM_LOOKUP_SOURCE.getSongBpm,
    ]);
    expect(await askedUrl()).toContain('api_key=first-key');
    getGetSongBpmKeyStore().getState().setKey('second-key');
    expect(await askedUrl()).toContain('api_key=second-key');
  });

  it('stops asking once the key is removed', () => {
    getGetSongBpmKeyStore().getState().setKey('first-key');
    getGetSongBpmKeyStore().getState().removeKey();
    expect(lookups()).toEqual([]);
  });
});
