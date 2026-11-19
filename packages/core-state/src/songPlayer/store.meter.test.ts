import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RATE } from '../stemPlayer/store.test-helper.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import { openedSong, SONG_ID, songRecord } from './store.test-helper.ts';

const BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const FOUR_FOUR = songRecord({ beats: BEATS, downbeatIndices: [0, 4] });
const TRIPLE = { ...NO_METER_OVERRIDE, meterBeatsPerBar: GRID_METER.triple };
const QUADRUPLE = {
  ...NO_METER_OVERRIDE,
  meterBeatsPerBar: GRID_METER.quadruple,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the song player's meter override", () => {
  it('re-derives the bars and resends them to a running click', async () => {
    const { commands, store } = await openedSong(FOUR_FOUR);
    await store.getState().toggleClick();
    store.getState().meterOverrideChanged(SONG_ID, TRIPLE);
    await vi.runAllTimersAsync();
    expect(store.getState().downbeatIndices).toEqual([0, 3, 6]);
    expect(store.getState().meterOverride).toEqual(TRIPLE);
    expect(commands.setGrid).toHaveBeenLastCalledWith(BEATS, [0, 3, 6], 0);
  });

  it('moves bar one to the beat at the stored time', async () => {
    const { store } = await openedSong(FOUR_FOUR);
    store.getState().meterOverrideChanged(SONG_ID, {
      ...NO_METER_OVERRIDE,
      barOneSeconds: 0.5,
    });
    expect(store.getState().downbeatIndices).toEqual([1, 5]);
  });

  it('resends nothing when the bars come out the same', async () => {
    const { commands, store } = await openedSong(FOUR_FOUR);
    await store.getState().toggleClick();
    commands.setGrid.mockClear();
    store.getState().meterOverrideChanged(SONG_ID, QUADRUPLE);
    await vi.runAllTimersAsync();
    expect(store.getState().meterOverride).toEqual(QUADRUPLE);
    expect(store.getState().downbeatIndices).toEqual([0, 4]);
    expect(commands.setGrid).not.toHaveBeenCalled();
  });

  it('ignores a change for another song', async () => {
    const { store } = await openedSong(FOUR_FOUR);
    store.getState().meterOverrideChanged(SONG_ID + 1, TRIPLE);
    expect(store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(store.getState().downbeatIndices).toEqual([0, 4]);
  });

  it('back to detected restores the analysed bars', async () => {
    const { store } = await openedSong({ ...FOUR_FOUR, ...TRIPLE });
    expect(store.getState().downbeatIndices).toEqual([0, 3, 6]);
    store.getState().meterOverrideChanged(SONG_ID, NO_METER_OVERRIDE);
    expect(store.getState().downbeatIndices).toEqual([0, 4]);
  });

  it('reports what analysis detected, whatever the override', async () => {
    const { store } = await openedSong(
      songRecord({
        beats: BEATS,
        downbeatIndices: [1, 4],
        meterBeatsPerBar: GRID_METER.quadruple,
      }),
    );
    expect(store.getState().detected).toEqual({
      meter: GRID_METER.triple,
      barOneSeconds: 0.5,
    });
  });
});

describe('the beat at the playhead', () => {
  it('is the beat nearest the engine position, read when asked', async () => {
    const { engine, store } = await openedSong(FOUR_FOUR);
    engine.position = secondsToFrames(1.3, RATE);
    expect(store.getState().playheadBeatSeconds()).toBe(1.5);
    engine.position = secondsToFrames(1.2, RATE);
    expect(store.getState().playheadBeatSeconds()).toBe(1);
  });

  it('is nothing without a grid', async () => {
    const { store } = await openedSong(songRecord({ beats: [] }));
    expect(store.getState().playheadBeatSeconds()).toBeNull();
  });
});
