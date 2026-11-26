import { MS_PER_SECOND } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCK_REFUSAL, REANCHOR_INTERVAL_MS } from './store.ts';
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
const FAST = 1.25;
const NOW_FRAME = START_MS * FRAMES_PER_MS;
const REANCHORED_SEC = SONG_SEC + REANCHOR_INTERVAL_MS / MS_PER_SECOND;
const REANCHORED_FRAME = (START_MS + REANCHOR_INTERVAL_MS) * FRAMES_PER_MS;

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
  it('sends the stored beat grid in song seconds, not a constant tempo', async () => {
    const { outcome, store, grids, anchors, readGrid } = await accepted();
    expect(outcome).toEqual({ locked: true });
    expect(readGrid).toHaveBeenCalledWith(MATCH);
    expect(anchors()).toEqual([]);
    const [beats, downbeats] = grids()[0] ?? [];
    expect(beats).toEqual(DRIFTING.beats);
    expect(downbeats).toEqual(DRIFTING.downbeatIndices);
    expect(store.getState().lock?.grid).toEqual(DRIFTING);
    expect(store.getState().bpm).toBe(MATCH.bpm);
    expect(store.getState().offer).toBeUndefined();
  });

  it('anchors the grid to the song only once the grid is in', async () => {
    const fake = offered();
    let gridIn: ((result: number) => void) | undefined;
    fake.commands.setGrid.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          gridIn = resolve;
        }),
    );
    await fake.store.getState().acceptOffer();
    await settle();
    expect(fake.grids()).toHaveLength(1);
    expect(fake.gridAnchors()).toEqual([]);
    gridIn?.(KB_RESULT.KB_OK);
    await settle();
    expect(fake.gridAnchors()).toEqual([[SONG_SEC, NOW_FRAME, 1]]);
    expect(fake.commands.metronomeAnchorExternal).not.toHaveBeenCalled();
  });

  it('re-anchors on the cadence without sending the grid again', async () => {
    const fake = await accepted();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    await settle();
    expect(fake.grids()).toHaveLength(1);
    expect(fake.gridAnchors()).toHaveLength(2);
    const [songSec, frame, rate] = fake.gridAnchors()[1] ?? [];
    expect(songSec).toBeCloseTo(REANCHORED_SEC, 9);
    expect(frame).toBe(REANCHORED_FRAME);
    expect(rate).toBe(1);
    expect(fake.anchors()).toEqual([]);
  });

  it('re-anchors to where the song is when it runs ahead', async () => {
    const fake = await accepted();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    fake.report([
      snapshot({
        positionMs: REANCHORED_SEC * MS_PER_SECOND + AHEAD_MS,
        positionUpdatedAtMs: START_MS + REANCHOR_INTERVAL_MS,
      }),
    ]);
    await settle();
    expect(fake.grids()).toHaveLength(1);
    expect(fake.gridAnchors().at(-1)?.[0]).toBeCloseTo(
      REANCHORED_SEC + AHEAD_MS / MS_PER_SECOND,
      9,
    );
    expect(fake.store.getState().songAheadOfClickMs).toBeCloseTo(AHEAD_MS, 9);
  });

  it('runs the grid at the song speed', async () => {
    const fake = await accepted(
      offered(
        fakePlayAlong({
          grid: DRIFTING,
          sessions: [snapshot({ speed: FAST })],
        }),
      ),
    );
    expect(fake.gridAnchors()).toEqual([[SONG_SEC, NOW_FRAME, FAST]]);
  });

  it('pauses with the song and resumes on the same grid', async () => {
    const fake = await accepted();
    fake.report([snapshot({ playing: false, speed: 0 })]);
    expect(fake.commands.metronomePause).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    fake.report([
      snapshot({ positionUpdatedAtMs: START_MS + REANCHOR_INTERVAL_MS }),
    ]);
    await settle();
    expect(fake.grids()).toHaveLength(1);
    expect(fake.gridAnchors()).toHaveLength(2);
    expect(fake.gridAnchors()[1]?.[0]).toBeCloseTo(SONG_SEC, 9);
  });

  it('never anchors a grid the engine refused', async () => {
    const fake = await accepted(
      offered(
        fakePlayAlong({
          grid: DRIFTING,
          gridResult: KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
        }),
      ),
    );
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    await settle();
    expect(fake.gridAnchors()).toEqual([]);
    expect(fake.anchors()).toEqual([]);
  });

  it('refuses with no offer on screen', async () => {
    const fake = fakePlayAlong({ grid: DRIFTING });
    expect(await fake.store.getState().acceptOffer()).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.noOffer,
    });
    expect(fake.calls).toEqual([]);
  });

  it('refuses a song whose stored grid is empty', async () => {
    const fake = offered(fakePlayAlong());
    expect(await fake.store.getState().acceptOffer()).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.noGrid,
    });
    expect(fake.store.getState().lock).toBeUndefined();
  });

  it('refuses when the track changed while the grid was read', async () => {
    const fake = offered();
    const accepting = fake.store.getState().acceptOffer();
    fake.report([snapshot({ title: 'Next song' })]);
    expect(await accepting).toEqual({
      locked: false,
      reason: LOCK_REFUSAL.noOffer,
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
