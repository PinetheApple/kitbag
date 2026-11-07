import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { opened, stem } from './store.test-helper.ts';

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
});
