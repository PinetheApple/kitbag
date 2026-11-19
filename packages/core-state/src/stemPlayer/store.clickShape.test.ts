import { CLICK_RATE, GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { KB_GRID_RATE, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { meterSaved, opened, stem } from './store.test-helper.ts';

const SEVEN = [3, 2, 2];
const FOUR_FOUR = [{ beat: 0, beatsPerBar: GRID_METER.quadruple }];
const SAVED = { clickGrouping: SEVEN, clickRate: CLICK_RATE.half };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Song = Awaited<ReturnType<typeof opened>>;

function sentAfterLastGrid({ commands }: Song) {
  const lastGrid = Math.max(...commands.setGrid.mock.invocationCallOrder);
  const after = (calls: readonly number[]) =>
    calls.some((order) => order > lastGrid);
  return {
    grouping: after(commands.setGridGrouping.mock.invocationCallOrder),
    rate: after(commands.setGridRate.mock.invocationCallOrder),
  };
}

describe("a stem song's saved click", () => {
  it('opens with the grouping and rate it was saved with', async () => {
    const { store } = await opened([stem(1)], SAVED);
    expect(store.getState()).toMatchObject(SAVED);
  });

  it('goes to the engine after the grid when the click turns on', async () => {
    const song = await opened([stem(1)], { ...SAVED, bars: FOUR_FOUR });
    await song.store.getState().toggleClick();
    expect(sentAfterLastGrid(song)).toEqual({ grouping: true, rate: true });
    expect(song.commands.setGridGrouping).toHaveBeenLastCalledWith(SEVEN);
    expect(song.commands.setGridRate).toHaveBeenLastCalledWith(
      KB_GRID_RATE.KB_GRID_RATE_HALF,
    );
  });

  it('goes again after a meter change sends a new grid', async () => {
    const song = await opened([stem(1)], { ...SAVED, bars: FOUR_FOUR });
    await song.store.getState().toggleClick();
    vi.clearAllMocks();
    meterSaved(song.store, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await vi.runAllTimersAsync();
    expect(song.commands.setGrid).toHaveBeenCalledOnce();
    expect(sentAfterLastGrid(song)).toEqual({ grouping: true, rate: true });
  });

  it('goes again after the grid a click still turning on had to follow', async () => {
    const song = await opened([stem(1)], { ...SAVED, bars: FOUR_FOUR });
    let answer: (result: number) => void = () => undefined;
    song.commands.setGrid.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    const turningOn = song.store.getState().toggleClick();
    meterSaved(song.store, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
    answer(KB_RESULT.KB_OK);
    await turningOn;
    await vi.runAllTimersAsync();
    expect(song.commands.setGrid).toHaveBeenCalledTimes(2);
    expect(sentAfterLastGrid(song)).toEqual({ grouping: true, rate: true });
  });

  it('sends nothing to an engine with the click off', async () => {
    const { commands } = await opened([stem(1)], SAVED);
    expect(commands.setGridGrouping).not.toHaveBeenCalled();
    expect(commands.setGridRate).not.toHaveBeenCalled();
  });
});

describe('changing the click', () => {
  it('saves a grouping and plays it at once with the click on', async () => {
    const { store, records, commands } = await opened([stem(1)]);
    await store.getState().toggleClick();
    await store.getState().setClickGrouping(SEVEN);
    expect(store.getState().clickGrouping).toEqual(SEVEN);
    expect(records.saveStemSetClick).toHaveBeenCalledWith(7, {
      clickGrouping: SEVEN,
    });
    expect(commands.setGridGrouping).toHaveBeenLastCalledWith(SEVEN);
  });

  it('saves a rate and sends the engine its code', async () => {
    const { store, records, commands } = await opened([stem(1)]);
    await store.getState().toggleClick();
    await store.getState().setClickRate(CLICK_RATE.double);
    expect(store.getState().clickRate).toBe(CLICK_RATE.double);
    expect(records.saveStemSetClick).toHaveBeenCalledWith(7, {
      clickRate: CLICK_RATE.double,
    });
    expect(commands.setGridRate).toHaveBeenLastCalledWith(
      KB_GRID_RATE.KB_GRID_RATE_DOUBLE,
    );
  });

  it('saves but does not send while the click is off', async () => {
    const { store, records, commands } = await opened([stem(1)]);
    await store.getState().setClickRate(CLICK_RATE.half);
    expect(records.saveStemSetClick).toHaveBeenCalledOnce();
    expect(commands.setGridRate).not.toHaveBeenCalled();
  });

  it('puts the previous click back when the save fails', async () => {
    const { store, records, commands } = await opened([stem(1)], SAVED);
    await store.getState().toggleClick();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    records.saveStemSetClick.mockRejectedValueOnce(new Error('disk full'));
    await store.getState().setClickGrouping([2, 2, 3]);
    expect(store.getState().clickGrouping).toEqual(SEVEN);
    expect(commands.setGridGrouping).toHaveBeenLastCalledWith(SEVEN);
  });

  it('keeps a newer pick when an older save fails', async () => {
    const { store, records } = await opened([stem(1)], SAVED);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    records.saveStemSetClick.mockRejectedValueOnce(new Error('disk full'));
    const failing = store.getState().setClickRate(CLICK_RATE.double);
    await store.getState().setClickRate(CLICK_RATE.single);
    await failing;
    expect(store.getState().clickRate).toBe(CLICK_RATE.single);
  });

  it('refuses a grouping the engine would refuse', async () => {
    const { store, records } = await opened([stem(1)]);
    await store.getState().setClickGrouping([3, 0]);
    expect(store.getState().clickGrouping).toEqual([]);
    expect(records.saveStemSetClick).not.toHaveBeenCalled();
  });

  it('is left alone by Reset mix', async () => {
    const { store } = await opened([stem(1)], SAVED);
    store.getState().resetMix();
    expect(store.getState()).toMatchObject(SAVED);
  });
});
