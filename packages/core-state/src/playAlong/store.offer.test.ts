import { MS_PER_SECOND } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCK_REFUSAL, REANCHOR_INTERVAL_MS } from './store.ts';
import { toBlob } from '../library/presetMapping.ts';
import { initialConfig } from '../metronome/store.ts';
import {
  BPM,
  call,
  presetShelf,
  fakePlayAlong,
  FRAMES_PER_MS,
  OTHER_ID,
  SESSION_ID,
  snapshot,
  STANDALONE,
  START_MS,
  settle,
} from './store.test-helper.ts';

const MATCH = { kind: 'song', id: 3, bpm: 113 } as const;
const SONG_SEC = 10;
const DRIFTING = {
  beats: [8.9, 9.4, 9.95, 10.55, 11.2, 11.9, 12.65],
  downbeatIndices: [0, 4],
};
const AHEAD_MS = 20;
const PRESET_BEATS = 3;
const QUARTER = 4;
const PRESET_METER = { beatsPerBar: PRESET_BEATS, denominator: QUARTER };
const PRESET_DOWNBEATS = [0, 3, 6];
const TRACK_SECONDS = (snapshot().durationMs ?? 0) / MS_PER_SECOND;
const PRESET_ROW = {
  name: 'Song',
  title: 'Song',
  artist: 'Band',
  bpm: BPM,
  beatsPerBar: PRESET_BEATS,
  denominator: QUARTER,
  subdivision: 1,
  accents: toBlob([2, 0, 0]),
  sound: 0,
};
const presetOnSong = () =>
  presetShelf([{ ...PRESET_ROW, librarySongId: MATCH.id }]);
const presetOnTrack = () =>
  presetShelf([
    {
      ...PRESET_ROW,
      librarySongId: null,
      source: SESSION_ID,
      lengthSeconds: TRACK_SECONDS,
    },
  ]);
const BEAT_SEC = 0.5;
const PICKUP_GRID = {
  beats: Array.from({ length: 13 }, (_, beat) => SONG_SEC + beat * BEAT_SEC),
  downbeatIndices: [2, 6, 10],
};
const PICKUP_PRESET_DOWNBEATS = [2, 5, 8, 11];
const FAST = 1.25;
const NOW_FRAME = START_MS * FRAMES_PER_MS;
const REANCHORED_SEC = SONG_SEC + REANCHOR_INTERVAL_MS / MS_PER_SECOND;
const REANCHORED_FRAME = (START_MS + REANCHOR_INTERVAL_MS) * FRAMES_PER_MS;

afterEach(() => {
  vi.useRealTimers();
});

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

  it('unlocks and says why when the engine refuses the grid', async () => {
    const fake = await accepted(
      offered(
        fakePlayAlong({
          grid: DRIFTING,
          gridResult: KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
        }),
      ),
    );
    expect(fake.outcome).toEqual({ locked: true });
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.store.getState().lastRefusal).toBe(LOCK_REFUSAL.gridRejected);
    expect(fake.calls).toContain('clearGrid()');
    expect(fake.calls).toContain(call('metronomeSelectSlot', STANDALONE));
    vi.advanceTimersByTime(REANCHOR_INTERVAL_MS);
    await settle();
    expect(fake.gridAnchors()).toEqual([]);
    expect(fake.anchors()).toEqual([]);
  });

  it('unlocks and says why when sending the grid fails', async () => {
    const fake = offered();
    fake.commands.setGrid.mockImplementationOnce(() =>
      Promise.reject(new Error('bridge')),
    );
    await accepted(fake);
    expect(fake.store.getState().lock).toBeUndefined();
    expect(fake.store.getState().lastRefusal).toBe(LOCK_REFUSAL.gridRejected);
    expect(fake.calls).toContain(call('metronomeSelectSlot', STANDALONE));
  });

  it('forgets the refusal on the next lock', async () => {
    const fake = await accepted(
      offered(
        fakePlayAlong({
          grid: DRIFTING,
          gridResult: KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
        }),
      ),
    );
    fake.store.getState().setBpm(BPM);
    fake.store.getState().tap(START_MS);
    expect(fake.store.getState().lastRefusal).toBeUndefined();
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

describe('the meter from the song preset', () => {
  it('names the preset meter on the offer', async () => {
    const fake = offered(
      fakePlayAlong({ grid: DRIFTING, shelf: presetOnSong() }),
    );
    await settle();
    expect(fake.store.getState().offer?.meter).toEqual(PRESET_METER);
  });

  it('names no meter when the song has no preset', async () => {
    const fake = offered();
    await settle();
    expect(fake.store.getState().offer).toBeDefined();
    expect(fake.store.getState().offer?.meter).toBeUndefined();
  });

  it('locks with the preset meter and its downbeats', async () => {
    const fake = offered(
      fakePlayAlong({ grid: DRIFTING, shelf: presetOnSong() }),
    );
    await settle();
    await accepted(fake);
    expect(fake.store.getState().pattern).toMatchObject(PRESET_METER);
    expect(fake.grids().at(-1)?.[1]).toEqual(PRESET_DOWNBEATS);
  });

  it('counts preset bars from the detected bar one after a pickup', async () => {
    const fake = offered(
      fakePlayAlong({ grid: PICKUP_GRID, shelf: presetOnSong() }),
    );
    await settle();
    await accepted(fake);
    expect(fake.grids().at(-1)?.[1]).toEqual(PICKUP_PRESET_DOWNBEATS);
  });

  it('names and locks with a preset matched by the track, not linked', async () => {
    const fake = offered(
      fakePlayAlong({ grid: DRIFTING, shelf: presetOnTrack() }),
    );
    await settle();
    expect(fake.store.getState().offer?.meter).toEqual(PRESET_METER);
    fake.store.getState().setBeats(initialConfig().beatsPerBar, QUARTER);
    await accepted(fake);
    expect(fake.store.getState().pattern).toMatchObject(PRESET_METER);
    expect(fake.grids().at(-1)?.[1]).toEqual(PRESET_DOWNBEATS);
  });

  it('names a preset saved while locked once it offers again', async () => {
    const fake = await accepted();
    fake.store.getState().setBeats(PRESET_BEATS, QUARTER);
    await fake.store.getState().saveForTrack();
    fake.store.getState().unlock();
    await settle();
    expect(fake.store.getState().offer?.meter).toEqual(PRESET_METER);
  });

  it('puts the preset meter back over a meter edited before accepting', async () => {
    const fake = offered(
      fakePlayAlong({ grid: DRIFTING, shelf: presetOnSong() }),
    );
    await settle();
    fake.store.getState().setBeats(initialConfig().beatsPerBar, QUARTER);
    await accepted(fake);
    expect(fake.store.getState().pattern).toMatchObject(PRESET_METER);
  });

  it('keeps the detected downbeats without a preset', async () => {
    const fake = offered();
    await settle();
    await accepted(fake);
    expect(fake.store.getState().pattern.beatsPerBar).toBe(
      initialConfig().beatsPerBar,
    );
    expect(fake.grids().at(-1)?.[1]).toEqual(DRIFTING.downbeatIndices);
  });
});
