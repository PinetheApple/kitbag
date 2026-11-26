import { describe, expect, it, vi } from 'vitest';

import { RATE } from '../stemPlayer/store.test-helper.ts';
import { onSongStarting } from '../stemPlayer/songStarting.ts';
import { openedSong } from './store.test-helper.ts';

const MID_SONG = RATE * 4;

describe('starting a library song tells other Kitbag clicks', () => {
  it('on a resume mid-song as well as from the top', async () => {
    const { store, commands, engine } = await openedSong();
    store.getState().togglePlay();
    engine.playing = true;
    store.getState().togglePlay();
    engine.playing = false;
    engine.position = MID_SONG;
    vi.clearAllMocks();
    const starting = vi.fn(() => {
      expect(commands.mixerPlay).not.toHaveBeenCalled();
    });
    const stop = onSongStarting(starting);
    store.getState().togglePlay();
    stop();
    expect(commands.mixerPlay).toHaveBeenCalledOnce();
    expect(starting).toHaveBeenCalledOnce();
  });
});
