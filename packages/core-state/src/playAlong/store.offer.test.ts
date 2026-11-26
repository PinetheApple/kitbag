import { MS_PER_SECOND } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { REANCHOR_INTERVAL_MS, TAP_REFUSAL } from './store.ts';
import {
  BPM,
  fakePlayAlong,
  FRAMES_PER_MS,
  OTHER_ID,
  SESSION_ID,
  snapshot,
  START_MS,
} from './store.test-helper.ts';

const MATCH = { kind: 'song', id: 3, bpm: 113 } as const;
const SONG_SEC = 10;
const DRIFTING = {
  beats: [8.9, 9.4, 9.95, 10.55, 11.2, 11.9, 12.65],
  downbeatIndices: [0, 4],
};
const AHEAD_MS = 20;
const ANCHOR_FRAME = START_MS * FRAMES_PER_MS;

afterEach(() => {
  vi.useRealTimers();
});

async function settle() {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

function offered(fake = fakePlayAlong({ grid: DRIFTING })) {
  fake.store.getState().watchLibrary();
  fake.ladder.found(MATCH);
  return fake;
}

async function accepted(fake = offered()) {
  const outcome = await fake.store.getState().acceptOffer();
  await settle();
  return { ...fake, outcome };
}

const placed = (shiftSec = 0) =>
  DRIFTING.beats.map((beat) => beat - SONG_SEC + shiftSec);

function expectBeats(actual: readonly number[] | undefined, want: number[]) {
  expect(actual).toHaveLength(want.length);
  want.forEach((beat, i) => {
    expect(actual?.[i]).toBeCloseTo(beat, 9);
  });
}

describe('the library offer', () => {
  it('looks up the playing track once the screen watches', () => {
    const fake = fakePlayAlong();
    fake.store.getState().watchLibrary();
    expect(fake.ladder.lookUp).toHaveBeenCalledWith({
      title: 'Song',
      artist: 'Band',
    });
  });

  it('offers an analysed library song that matches the track', () => {
    const fake = offered();
    expect(fake.store.getState().offer).toEqual({
      sessionId: SESSION_ID,
      track: { title: 'Song', artist: 'Band', durationMs: 200_000 },
      match: MATCH,
    });
  });

  it('never locks or touches the engine by itself', async () => {
    const fake = offered();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS * 4);
    await settle();
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.calls).toEqual([]);
    expect(fake.readGrid).not.toHaveBeenCalled();
  });

  it('offers nothing when the track matches no library song', () => {
    const fake = fakePlayAlong();
    fake.store.getState().watchLibrary();
    fake.ladder.found(null);
    expect(fake.store.getState().offer).toBeUndefined();
  });

  it('offers nothing for a match found for another track', () => {
    const fake = fakePlayAlong();
    fake.store.getState().watchLibrary();
    fake.ladder.ladder.setState({
      track: { title: 'Other song', artist: 'Band' },
      libraryMatch: MATCH,
    });
    expect(fake.store.getState().offer).toBeUndefined();
  });

  it('clears the offer when the track changes', () => {
    const fake = offered();
    fake.report([snapshot({ title: 'Next song' })]);
    expect(fake.store.getState().offer).toBeUndefined();
    expect(fake.ladder.lookUp).toHaveBeenLastCalledWith({
      title: 'Next song',
      artist: 'Band',
    });
  });

  it('clears the offer when another app is chosen', () => {
    const other = snapshot({ sessionId: OTHER_ID, title: 'Other song' });
    const fake = offered(fakePlayAlong({ sessions: [snapshot(), other] }));
    fake.media.getState().pick(OTHER_ID);
    expect(fake.store.getState().offer).toBeUndefined();
  });

  it('keeps a dismissed offer away for the rest of the track', () => {
    const fake = offered();
    fake.store.getState().dismissOffer();
    fake.report([snapshot({ positionMs: 12_000 })]);
    fake.ladder.found({ ...MATCH });
    expect(fake.store.getState().offer).toBeUndefined();
  });

  it('offers again on the next matching track after a dismiss', () => {
    const fake = offered();
    fake.store.getState().dismissOffer();
    fake.report([snapshot({ title: 'Next song' })]);
    fake.ladder.found(MATCH);
    expect(fake.store.getState().offer?.track.title).toBe('Next song');
  });

  it('stops following once the screen lets go', () => {
    const fake = fakePlayAlong();
    const stop = fake.store.getState().watchLibrary();
    stop();
    fake.ladder.found(MATCH);
    fake.report([snapshot({ title: 'Next song' })]);
    expect(fake.store.getState().offer).toBeUndefined();
    expect(fake.ladder.lookUp).toHaveBeenCalledOnce();
  });
});

describe('accepting the offer', () => {
  it('locks on the stored beat grid, not a constant tempo', async () => {
    const { outcome, store, grids, anchors, readGrid } = await accepted();
    expect(outcome).toEqual({ locked: true });
    expect(readGrid).toHaveBeenCalledWith(MATCH);
    expect(anchors()).toEqual([]);
    const [beats, downbeats, anchorFrame] = grids()[0] ?? [];
    expectBeats(beats, placed());
    expect(downbeats).toEqual(DRIFTING.downbeatIndices);
    expect(anchorFrame).toBe(ANCHOR_FRAME);
    expect(store.getState().lock?.grid).toEqual(DRIFTING);
    expect(store.getState().bpm).toBe(MATCH.bpm);
    expect(store.getState().offer).toBeUndefined();
  });

  it('starts the click only after the grid is in', async () => {
    const { calls } = await accepted();
    const gridAt = calls.findIndex((entry) => entry.startsWith('setGrid('));
    const startAt = calls.indexOf(`metronomeStart(${String(ANCHOR_FRAME)})`);
    expect(gridAt).toBeGreaterThanOrEqual(0);
    expect(startAt).toBeGreaterThan(gridAt);
  });

  it('keeps a drifting grid on the beat across re-anchors', async () => {
    const fake = await accepted();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    await settle();
    const [beats, , anchorFrame] = fake.grids()[1] ?? [];
    expectBeats(beats, placed());
    expect(anchorFrame).toBe(ANCHOR_FRAME);
  });

  it('moves the grid with the song when the song runs ahead', async () => {
    const fake = await accepted();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    fake.report([
      snapshot({
        positionMs: SONG_SEC * MS_PER_SECOND + REANCHOR_INTERVAL_MS + AHEAD_MS,
        positionUpdatedAtMs: START_MS + REANCHOR_INTERVAL_MS,
      }),
    ]);
    await settle();
    expectBeats(fake.grids().at(-1)?.[0], placed(-AHEAD_MS / MS_PER_SECOND));
    expect(fake.store.getState().songAheadOfClickMs).toBeCloseTo(AHEAD_MS, 9);
  });

  it('refuses with no offer on screen', async () => {
    const fake = fakePlayAlong({ grid: DRIFTING });
    expect(await fake.store.getState().acceptOffer()).toEqual({
      locked: false,
      reason: TAP_REFUSAL.noOffer,
    });
    expect(fake.calls).toEqual([]);
  });

  it('refuses a song whose stored grid is empty', async () => {
    const fake = offered(fakePlayAlong());
    expect(await fake.store.getState().acceptOffer()).toEqual({
      locked: false,
      reason: TAP_REFUSAL.noGrid,
    });
    expect(fake.store.getState().lock).toBeUndefined();
  });

  it('refuses when the track changed while the grid was read', async () => {
    const fake = offered();
    const accepting = fake.store.getState().acceptOffer();
    fake.report([snapshot({ title: 'Next song' })]);
    expect(await accepting).toEqual({
      locked: false,
      reason: TAP_REFUSAL.noOffer,
    });
    expect(fake.store.getState().lock).toBeUndefined();
  });

  it('clears the grid on unlock so a later tap lock can sound', async () => {
    const fake = await accepted();
    fake.store.getState().unlock();
    expect(fake.calls).toContain('clearGrid()');
    fake.store.getState().tap(START_MS);
    expect(fake.anchors()).toHaveLength(1);
  });

  it('drops the grid for a typed tempo and follows that tempo', async () => {
    const fake = await accepted();
    fake.calls.length = 0;
    fake.store.getState().setBpm(BPM);
    expect(fake.calls[0]).toBe('clearGrid()');
    expect(fake.store.getState().lock?.grid).toBeUndefined();
    expect(fake.anchors().at(-1)?.[2]).toBe(BPM);
  });

  it('offers again after unlocking the same track', async () => {
    const fake = await accepted();
    fake.store.getState().unlock();
    expect(fake.store.getState().offer?.match).toEqual(MATCH);
  });
});
