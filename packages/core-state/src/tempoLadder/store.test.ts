import { describe, expect, it } from 'vitest';

import { BPM_BOUNDS } from '../metronome/config.ts';
import { tapTimeoutMs } from '../tapTempo/tapTempo.ts';
import getSongBpmSearch from './fixtures/getsongbpm-search.json';
import { fakeHttp, GETSONGBPM_SEARCH } from './http.test-helper.ts';
import type { HttpGet } from './http.ts';
import { ladderRuntime } from './ladder.test-helper.ts';
import { songRow } from './libraryRows.test-helper.ts';
import { BPM_SOURCE } from './sources.ts';
import { TAPS_TO_SET_TEMPO } from '../tapTempo/tapTempo.ts';
import { createTempoLadderStore } from './store.ts';

const SONG = { title: 'Under Pressure', artist: 'Queen' };
const OTHER = { title: 'Radio Ga Ga', artist: 'Queen' };
const BEAT_MS = 500;
const KEY = 'test-key';
const ONLINE_HIT = { [GETSONGBPM_SEARCH]: getSongBpmSearch };

function gatedHttp() {
  const { httpGet: answer } = fakeHttp(ONLINE_HIT);
  let open: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const httpGet: HttpGet = async (url, init) => {
    await gate;
    return answer(url, init);
  };
  return {
    httpGet,
    open: () => {
      open();
    },
  };
}

function tapAt(
  store: ReturnType<typeof createTempoLadderStore>,
  count: number,
) {
  for (let tap = 0; tap < count; tap += 1) store.getState().tap(tap * BEAT_MS);
}

describe('tempo ladder store', () => {
  it('looks up the playing song and names the source', async () => {
    const runtime = ladderRuntime({
      httpGet: fakeHttp(ONLINE_HIT).httpGet,
      key: KEY,
    });
    const store = createTempoLadderStore(() => runtime);
    const lookup = store.getState().lookUp(SONG);
    expect(store.getState().looking).toBe(true);
    await lookup;
    expect(store.getState()).toMatchObject({
      track: SONG,
      looking: false,
      bpm: 114,
      source: BPM_SOURCE.getSongBpm,
      tried: [BPM_SOURCE.library, BPM_SOURCE.getSongBpm],
    });
  });

  it('offers the library song for the lock', async () => {
    const runtime = ladderRuntime({ rows: [songRow({ id: 5 })] });
    const store = createTempoLadderStore(() => runtime);
    await store.getState().lookUp(SONG);
    expect(store.getState().libraryMatch).toEqual({
      kind: 'song',
      id: 5,
      bpm: 113,
    });
  });

  it('drops the answer for a track that is no longer playing', async () => {
    const http = gatedHttp();
    const runtime = ladderRuntime({ httpGet: http.httpGet, key: KEY });
    const store = createTempoLadderStore(() => runtime);
    const first = store.getState().lookUp(SONG);
    const second = store.getState().lookUp(OTHER);
    http.open();
    await Promise.all([first, second]);
    expect(store.getState().track).toEqual(OTHER);
    expect(store.getState().bpm).toBeNull();
  });

  it('ends a lookup the runtime cannot serve as not found', async () => {
    const store = createTempoLadderStore(() => {
      throw new Error('Tempo ladder is not configured');
    });
    await store.getState().lookUp(SONG);
    expect(store.getState()).toMatchObject({
      track: SONG,
      looking: false,
      bpm: null,
      source: null,
    });
  });

  it('keeps a typed tempo when the same track is announced again', async () => {
    const http = fakeHttp(ONLINE_HIT);
    const runtime = ladderRuntime({ httpGet: http.httpGet, key: KEY });
    const store = createTempoLadderStore(() => runtime);
    await store.getState().lookUp(SONG);
    store.getState().enter(150);
    const asked = http.urls.length;
    await store
      .getState()
      .lookUp({ title: 'Under Pressure (Remastered 2011)', artist: 'QUEEN' });
    expect(store.getState()).toMatchObject({
      bpm: 150,
      source: BPM_SOURCE.manual,
    });
    expect(http.urls).toHaveLength(asked);
  });

  it('names a halved or doubled looked-up tempo typed', async () => {
    const runtime = ladderRuntime({
      httpGet: fakeHttp(ONLINE_HIT).httpGet,
      key: KEY,
    });
    const store = createTempoLadderStore(() => runtime);
    await store.getState().lookUp(SONG);
    store.getState().halve();
    expect(store.getState()).toMatchObject({
      bpm: 57,
      source: BPM_SOURCE.manual,
    });
    await store.getState().lookUp(OTHER);
    store.getState().enter(100, BPM_SOURCE.library);
    store.getState().double();
    expect(store.getState()).toMatchObject({
      bpm: 200,
      source: BPM_SOURCE.manual,
    });
  });

  it('takes an entered tempo with the source it names', () => {
    const store = createTempoLadderStore(() => ladderRuntime());
    store.getState().enter(113, BPM_SOURCE.library);
    expect(store.getState()).toMatchObject({
      bpm: 113,
      source: BPM_SOURCE.library,
    });
  });

  it('shows each tap landing and sets the tempo on the fourth', () => {
    const store = createTempoLadderStore(() => ladderRuntime());
    const landed: number[] = [];
    for (let tap = 0; tap < TAPS_TO_SET_TEMPO; tap += 1) {
      expect(store.getState().bpm).toBeNull();
      store.getState().tap(tap * BEAT_MS);
      landed.push(store.getState().tapsLanded);
    }
    expect(landed).toEqual([1, 2, 3, 4]);
    expect(store.getState()).toMatchObject({
      bpm: 120,
      source: BPM_SOURCE.tap,
    });
  });

  it('fills the four taps and no further', () => {
    const store = createTempoLadderStore(() => ladderRuntime());
    tapAt(store, TAPS_TO_SET_TEMPO + 1);
    expect(store.getState().tapsLanded).toBe(TAPS_TO_SET_TEMPO);
  });

  it('starts counting again after a pause', () => {
    const store = createTempoLadderStore(() => ladderRuntime());
    tapAt(store, 2);
    store.getState().tap(BEAT_MS + tapTimeoutMs(BPM_BOUNDS) + 1);
    expect(store.getState().tapsLanded).toBe(1);
  });

  it('keeps a tapped tempo when the lookup answers later', async () => {
    const http = gatedHttp();
    const runtime = ladderRuntime({ httpGet: http.httpGet, key: KEY });
    const store = createTempoLadderStore(() => runtime);
    const lookup = store.getState().lookUp(SONG);
    tapAt(store, TAPS_TO_SET_TEMPO);
    http.open();
    await lookup;
    expect(store.getState()).toMatchObject({
      bpm: 120,
      source: BPM_SOURCE.tap,
      tried: [BPM_SOURCE.library, BPM_SOURCE.getSongBpm],
    });
  });

  it('clears the taps for a new track', async () => {
    const store = createTempoLadderStore(() => ladderRuntime());
    tapAt(store, 2);
    await store.getState().lookUp(SONG);
    expect(store.getState().tapsLanded).toBe(0);
    store.getState().tap(2 * BEAT_MS);
    store.getState().tap(3 * BEAT_MS);
    expect(store.getState()).toMatchObject({ tapsLanded: 2, bpm: null });
  });

  it('halves, doubles and takes a typed tempo inside the range', () => {
    const store = createTempoLadderStore(() => ladderRuntime());
    store.getState().halve();
    expect(store.getState().bpm).toBeNull();
    store.getState().enter(171);
    store.getState().halve();
    expect(store.getState()).toMatchObject({
      bpm: 85.5,
      source: BPM_SOURCE.manual,
    });
    store.getState().double();
    expect(store.getState().bpm).toBe(171);
    store.getState().enter(BPM_BOUNDS.max + 1);
    expect(store.getState().bpm).toBe(BPM_BOUNDS.max);
  });
});
