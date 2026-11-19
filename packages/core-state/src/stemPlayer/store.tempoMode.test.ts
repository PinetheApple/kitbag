import {
  CLICK_RATE,
  GRID_METER,
  TEMPO_MODE,
  TEMPO_SOURCE,
  type BundleTempo,
  type GridMeter,
  type StemSetRecord,
} from '@kitbag/core-db';
import { KB_GRID_RATE } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { overrideDownbeats } from './meterOverride.ts';
import { opened, record, stem } from './store.test-helper.ts';
import { effectiveGrid, type TempoSong } from './tempoGrid.ts';

const GRID_BPM = 127;
const FITTED_BPM = 128;
const DRIFTING_BEATS = [0, 0.55, 1.1, 1.65, 2.2, 2.75, 3.3, 3.85];
const THREE_FOUR = [{ beat: 0, beatsPerBar: GRID_METER.triple }];
const SEVEN = [3, 2, 2];

const FOLLOW: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: FITTED_BPM,
  anchor: 0,
  beatsPerBar: GRID_METER.triple,
  source: TEMPO_SOURCE.detected,
};
const CONSTANT_ONLY: BundleTempo = { ...FOLLOW, mode: TEMPO_MODE.constant };

const SONG: Partial<StemSetRecord> = {
  bpm: GRID_BPM,
  beats: DRIFTING_BEATS,
  bars: THREE_FOUR,
  tempo: FOLLOW,
};

const openSong = (change: Partial<StemSetRecord> = {}) =>
  opened([stem(1, { durationSec: 4 })], { ...SONG, ...change });

type Song = Awaited<ReturnType<typeof openSong>>;

const SONG_GRID: TempoSong = record([stem(1, { durationSec: 4 })], SONG);
const UNSUPPORTED_METER = 5 as number as GridMeter;

const constantGrid = () => effectiveGrid(SONG_GRID, TEMPO_MODE.constant);

function sentAfterLastGrid({ commands }: Song) {
  const lastGrid = Math.max(...commands.setGrid.mock.invocationCallOrder);
  const after = (calls: readonly number[]) =>
    calls.some((order) => order > lastGrid);
  return {
    grouping: after(commands.setGridGrouping.mock.invocationCallOrder),
    rate: after(commands.setGridRate.mock.invocationCallOrder),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('opening a stem song with a tempo', () => {
  it("plays the bundle's grid in the bundle's mode", async () => {
    const { store } = await openSong();
    expect(store.getState()).toMatchObject({
      tempo: FOLLOW,
      tempoMode: TEMPO_MODE.follow,
      beats: DRIFTING_BEATS,
    });
    expect(store.getState().facts.bpm?.value).toBe(String(GRID_BPM));
  });

  it('plays the constant grid once constant was chosen', async () => {
    const { store } = await openSong({ chosenTempoMode: TEMPO_MODE.constant });
    expect(store.getState()).toMatchObject({
      tempoMode: TEMPO_MODE.constant,
      beats: constantGrid().beats,
      downbeatIndices: constantGrid().downbeatIndices,
    });
    expect(store.getState().facts.bpm?.value).toBe(String(FITTED_BPM));
  });

  it('puts a saved meter override on the constant grid', async () => {
    const override = {
      meterBeatsPerBar: GRID_METER.quadruple,
      barOneSeconds: 2.2,
    };
    const { store } = await openSong({
      ...override,
      chosenTempoMode: TEMPO_MODE.constant,
    });
    expect(store.getState().meterOverride).toEqual(override);
    expect(store.getState().downbeatIndices).toEqual(
      overrideDownbeats(constantGrid(), override),
    );
  });

  it('marks bars by the stored meter it keeps, not one it set aside', async () => {
    const { store } = await openSong({ meterBeatsPerBar: UNSUPPORTED_METER });
    const { meterOverride, downbeatIndices } = store.getState();
    expect(meterOverride.meterBeatsPerBar).toBeNull();
    expect(downbeatIndices).toEqual(
      overrideDownbeats(effectiveGrid(SONG_GRID), meterOverride),
    );
  });

  it('opens with no tempo mode for a bundle without tempo', async () => {
    const { store } = await openSong({ tempo: null });
    expect(store.getState().tempoMode).toBeNull();
  });
});

describe('switching the tempo mode', () => {
  it('plays and stores the chosen grid', async () => {
    const { store, records } = await openSong();
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    expect(store.getState()).toMatchObject({
      tempoMode: TEMPO_MODE.constant,
      beats: constantGrid().beats,
      downbeatIndices: constantGrid().downbeatIndices,
    });
    expect(store.getState().facts.bpm?.value).toBe(String(FITTED_BPM));
    expect(records.saveStemSetChosenTempoMode).toHaveBeenCalledWith(
      7,
      TEMPO_MODE.constant,
    );
  });

  it('switches back to the follow grid', async () => {
    const { store } = await openSong({ chosenTempoMode: TEMPO_MODE.constant });
    await store.getState().setTempoMode(TEMPO_MODE.follow);
    expect(store.getState().beats).toEqual(DRIFTING_BEATS);
    expect(store.getState().downbeatIndices).toEqual([0, 3, 6]);
    expect(store.getState().facts.bpm?.value).toBe(String(GRID_BPM));
  });

  it('keeps a meter override on the new grid', async () => {
    const override = {
      meterBeatsPerBar: GRID_METER.quadruple,
      barOneSeconds: 2.2,
    };
    const { store } = await openSong(override);
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    expect(store.getState().meterOverride).toEqual(override);
    expect(store.getState().downbeatIndices).toEqual(
      overrideDownbeats(constantGrid(), override),
    );
  });

  it('sends the new grid, then the click grouping and rate again', async () => {
    const song = await openSong({
      clickGrouping: SEVEN,
      clickRate: CLICK_RATE.half,
    });
    await song.store.getState().toggleClick();
    vi.clearAllMocks();
    await song.store.getState().setTempoMode(TEMPO_MODE.constant);
    await vi.runAllTimersAsync();
    expect(song.commands.setGrid).toHaveBeenCalledOnce();
    expect(song.commands.setGrid.mock.calls[0]?.[0]).toHaveLength(
      constantGrid().beats.length,
    );
    expect(sentAfterLastGrid(song)).toEqual({ grouping: true, rate: true });
    expect(song.commands.setGridGrouping).toHaveBeenLastCalledWith(SEVEN);
    expect(song.commands.setGridRate).toHaveBeenLastCalledWith(
      KB_GRID_RATE.KB_GRID_RATE_HALF,
    );
  });
});

describe('a tempo mode the bundle cannot build', () => {
  it('is refused for a constant export', async () => {
    const { store, records } = await openSong({ tempo: CONSTANT_ONLY });
    const before = store.getState().beats;
    await store.getState().setTempoMode(TEMPO_MODE.follow);
    expect(store.getState().tempoMode).toBe(TEMPO_MODE.constant);
    expect(store.getState().beats).toBe(before);
    expect(records.saveStemSetChosenTempoMode).not.toHaveBeenCalled();
  });

  it('is refused for a bundle without tempo', async () => {
    const { store, records } = await openSong({ tempo: null });
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    expect(store.getState().beats).toEqual(DRIFTING_BEATS);
    expect(records.saveStemSetChosenTempoMode).not.toHaveBeenCalled();
  });
});

describe('a tempo mode that does not store', () => {
  it('goes back to the grid it replaced', async () => {
    const { store, records } = await openSong();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    records.saveStemSetChosenTempoMode.mockRejectedValueOnce(new Error('disk'));
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    expect(store.getState()).toMatchObject({
      tempoMode: TEMPO_MODE.follow,
      beats: DRIFTING_BEATS,
      downbeatIndices: [0, 3, 6],
    });
    expect(store.getState().facts.bpm?.value).toBe(String(GRID_BPM));
  });

  it('leaves a later switch alone', async () => {
    const { store, records } = await openSong();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let fail: (error: Error) => void = () => undefined;
    records.saveStemSetChosenTempoMode.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const first = store.getState().setTempoMode(TEMPO_MODE.constant);
    await store.getState().setTempoMode(TEMPO_MODE.follow);
    await store.getState().setTempoMode(TEMPO_MODE.constant);
    fail(new Error('disk'));
    await first;
    expect(store.getState().tempoMode).toBe(TEMPO_MODE.constant);
  });

  it('leaves the next song alone', async () => {
    const { store, records } = await openSong();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let fail: (error: Error) => void = () => undefined;
    records.saveStemSetChosenTempoMode.mockImplementationOnce(
      () =>
        new Promise<void>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const first = store.getState().setTempoMode(TEMPO_MODE.constant);
    records.readStemSet.mockResolvedValueOnce(
      record([stem(1, { durationSec: 4 })], {
        ...SONG,
        chosenTempoMode: TEMPO_MODE.constant,
      }),
    );
    await store.getState().open(7, 1);
    fail(new Error('disk'));
    await first;
    expect(store.getState().tempoMode).toBe(TEMPO_MODE.constant);
  });
});
