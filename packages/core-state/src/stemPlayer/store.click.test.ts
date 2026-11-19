import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KB_RESULT } from '@kitbag/core-native';

import { createStemPlayerStore } from './store.ts';
import {
  fakeRuntime,
  meterSaved,
  opened,
  record,
  stem,
} from './store.test-helper.ts';

const BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const FOUR_FOUR = [{ beat: 0, beatsPerBar: GRID_METER.quadruple }];
const TRIPLE_OVERRIDE = {
  ...NO_METER_OVERRIDE,
  meterBeatsPerBar: GRID_METER.triple,
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the click's bars", () => {
  it("sends the song's bar marks as downbeat indices", async () => {
    const { commands, store } = await opened([stem(1)], {
      bars: [
        { beat: 1, beatsPerBar: 3 },
        { beat: 4, beatsPerBar: 2 },
      ],
    });
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(
      [0, 0.5, 1, 1.5, 2, 2.5, 3],
      [1, 4, 6],
      0,
    );
  });

  it('sends no downbeats for a song without bar marks', async () => {
    const { commands, store } = await opened([stem(1)]);
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(
      [0, 0.5, 1, 1.5, 2, 2.5, 3],
      [],
      0,
    );
  });

  it("follows the user's meter over the bar marks", async () => {
    const { commands, store } = await opened([stem(1)], {
      bars: FOUR_FOUR,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [0, 3, 6], 0);
  });

  it("starts the bars on the user's bar one", async () => {
    const { commands, store } = await opened([stem(1)], {
      bars: FOUR_FOUR,
      barOneSeconds: 0.5,
    });
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [1, 5], 0);
  });
});

describe('a meter saved while the song is open', () => {
  it('moves the bars the click gets', async () => {
    const { commands, store } = await opened([stem(1)], { bars: FOUR_FOUR });
    await store.getState().toggleClick();
    commands.setGrid.mockClear();
    meterSaved(store, TRIPLE_OVERRIDE);
    await vi.runAllTimersAsync();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [0, 3, 6], 0);
    expect(store.getState().meterOverride).toEqual(TRIPLE_OVERRIDE);
  });

  it('goes back to the bar marks when cleared', async () => {
    const { commands, store } = await opened([stem(1)], {
      bars: FOUR_FOUR,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await store.getState().toggleClick();
    commands.setGrid.mockClear();
    meterSaved(store, NO_METER_OVERRIDE);
    await vi.runAllTimersAsync();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [0, 4], 0);
  });

  it('does nothing with no song open', () => {
    const fake = fakeRuntime(record([stem(1)]));
    const store = createStemPlayerStore(() => fake.runtime);
    store.getState().meterOverrideChanged(record([]).id, TRIPLE_OVERRIDE);
    expect(store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(store.getState().downbeatIndices).toEqual([]);
    expect(fake.commands.setGrid).not.toHaveBeenCalled();
  });

  it('ignores a save for another stem song', async () => {
    const { commands, store } = await opened([stem(1)], { bars: FOUR_FOUR });
    await store.getState().toggleClick();
    commands.setGrid.mockClear();
    const otherSet = (store.getState().setId ?? 0) + 1;
    store.getState().meterOverrideChanged(otherSet, TRIPLE_OVERRIDE);
    await vi.runAllTimersAsync();
    expect(store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(store.getState().downbeatIndices).toEqual([0, 4]);
    expect(commands.setGrid).not.toHaveBeenCalled();
  });

  it('resends nothing when the bars come out the same', async () => {
    const { commands, store } = await opened([stem(1)], { bars: FOUR_FOUR });
    await store.getState().toggleClick();
    commands.setGrid.mockClear();
    const fourFour = {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.quadruple,
    };
    meterSaved(store, fourFour);
    await vi.runAllTimersAsync();
    expect(store.getState().meterOverride).toEqual(fourFour);
    expect(commands.setGrid).not.toHaveBeenCalled();
  });

  it('reaches a click that is still turning on', async () => {
    const { commands, store } = await opened([stem(1)], { bars: FOUR_FOUR });
    let answer: (result: number) => void = () => undefined;
    commands.setGrid.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    const turningOn = store.getState().toggleClick();
    meterSaved(store, TRIPLE_OVERRIDE);
    answer(KB_RESULT.KB_OK);
    await turningOn;
    await vi.runAllTimersAsync();
    expect(commands.setGrid).toHaveBeenLastCalledWith(BEATS, [0, 3, 6], 0);
    expect(store.getState().click).toBe(true);
  });
});
