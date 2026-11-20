import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { fakeMetronome, leftPlaying } from '../songPlayer/store.test-helper.ts';
import { BARS, opened, stem } from '../stemPlayer/store.test-helper.ts';
import { stopSongsForMetronome } from './metronomeTakeover.ts';

const SET_ID = 7;

async function songsWithNoScreen() {
  const stemSong = await opened([stem(1)]);
  stemSong.store.getState().acquireSong(SET_ID, BARS).release();
  const single = await leftPlaying();
  const metronome = fakeMetronome();
  const loads = createStore(() => ({ songLoads: 0 }));
  const stop = stopSongsForMetronome({
    loads,
    metronome: metronome.store.getState(),
    players: [stemSong.store, single.player],
  });
  const loadMetronomeSong = () => {
    loads.setState((s) => ({ songLoads: s.songLoads + 1 }));
  };
  const startMetronome = () => {
    metronome.store.getState().start();
  };
  return {
    stemSong,
    single,
    metronome,
    loadMetronomeSong,
    startMetronome,
    stop,
  };
}

describe('a metronome song loading over a song', () => {
  it('stops a stem song no screen holds', async () => {
    const { stemSong, loadMetronomeSong } = await songsWithNoScreen();
    expect(stemSong.store.getState().setId).toBe(SET_ID);
    loadMetronomeSong();
    expect(stemSong.store.getState().setId).toBeNull();
    expect(stemSong.commands.mixerStop).toHaveBeenCalled();
    expect(stemSong.commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('stops nothing once unsubscribed', async () => {
    const { stemSong, loadMetronomeSong, stop } = await songsWithNoScreen();
    stop();
    loadMetronomeSong();
    expect(stemSong.store.getState().setId).toBe(SET_ID);
  });
});

describe('the metronome starting over a song', () => {
  it('stops the stem song and removes its card before the click starts', async () => {
    const { stemSong, metronome, startMetronome } = await songsWithNoScreen();
    startMetronome();
    expect(stemSong.store.getState().setId).toBeNull();
    expect(stemSong.commands.songTransportHide).toHaveBeenCalledOnce();
    const [stopped] = stemSong.commands.mixerStop.mock.invocationCallOrder;
    const [started] =
      metronome.commands.metronomeStart.mock.invocationCallOrder;
    expect(stopped).toBeLessThan(started ?? 0);
  });

  it('stops a playing single song and removes its card', async () => {
    const { single, startMetronome } = await songsWithNoScreen();
    expect(single.player.getState().songId).not.toBeNull();
    startMetronome();
    expect(single.player.getState().songId).toBeNull();
    expect(single.commands.mixerStop).toHaveBeenCalled();
    expect(single.commands.songTransportHide).toHaveBeenCalledOnce();
  });

  it('stops nothing once unsubscribed', async () => {
    const { stemSong, single, startMetronome, stop } =
      await songsWithNoScreen();
    stop();
    startMetronome();
    expect(stemSong.store.getState().setId).toBe(SET_ID);
    expect(single.player.getState().songId).not.toBeNull();
  });
});
