import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { BARS, opened, stem } from '../stemPlayer/store.test-helper.ts';
import { stopStemSongOnMetronomeLoad } from './metronomeTakeover.ts';

const SET_ID = 7;

async function stemSongWithNoScreen() {
  const song = await opened([stem(1)]);
  song.store.getState().acquireSong(SET_ID, BARS).release();
  const loads = createStore(() => ({ songLoads: 0 }));
  const stop = stopStemSongOnMetronomeLoad({
    loads,
    closeStemSong: () => {
      song.store.getState().close();
    },
  });
  const loadMetronomeSong = () => {
    loads.setState((s) => ({ songLoads: s.songLoads + 1 }));
  };
  return { ...song, loadMetronomeSong, stop };
}

describe('a metronome song loading over a stem song', () => {
  it('stops a stem song no screen holds', async () => {
    const song = await stemSongWithNoScreen();
    expect(song.store.getState().setId).toBe(SET_ID);
    song.loadMetronomeSong();
    expect(song.store.getState().setId).toBeNull();
    expect(song.commands.mixerStop).toHaveBeenCalled();
    expect(song.commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('stops nothing once unsubscribed', async () => {
    const song = await stemSongWithNoScreen();
    song.stop();
    song.loadMetronomeSong();
    expect(song.store.getState().setId).toBe(SET_ID);
  });
});
