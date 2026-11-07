import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openedSong, songRecord } from './store.test-helper.ts';

const BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the song player's click bars", () => {
  it("sends the song's analysed downbeats", async () => {
    const { commands, store } = await openedSong(
      songRecord({ beats: BEATS, downbeatIndices: [1, 5] }),
    );
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [1, 5], 0);
  });

  it('drops downbeats past the grid it sends', async () => {
    const { commands, store } = await openedSong(
      songRecord({ beats: BEATS, downbeatIndices: [3, 7, 11] }),
    );
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [3], 0);
  });

  it('drops downbeats the engine would refuse, keeping the click', async () => {
    const { commands, store } = await openedSong(
      songRecord({ beats: BEATS, downbeatIndices: [-1, 1, 1.5, 3, 2, 3, 5] }),
    );
    await store.getState().toggleClick();
    expect(commands.setGrid).toHaveBeenCalledWith(BEATS, [1, 3, 5], 0);
    expect(store.getState().click).toBe(true);
  });
});
