import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onMixerSeek } from './mixerSeeked.ts';
import { opened, RATE, SEEK_MS, stem } from './store.test-helper.ts';

let seeked = vi.fn();
let stop: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
  seeked = vi.fn();
  stop = onMixerSeek(seeked);
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe('a seek in the app', () => {
  it('tells the playhead once the mixer is told', async () => {
    const { commands, store } = await opened([stem(1)]);
    seeked.mockImplementation(() => {
      expect(commands.mixerSeek).toHaveBeenCalledWith(2 * RATE);
    });
    store.getState().seek(2 * RATE);
    expect(seeked).toHaveBeenCalledOnce();
  });

  it('tells the playhead when a scrub lands', async () => {
    const { store } = await opened([stem(1)]);
    store.getState().scrub(3 * RATE);
    expect(seeked).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SEEK_MS);
    expect(seeked).toHaveBeenCalledOnce();
  });
});
