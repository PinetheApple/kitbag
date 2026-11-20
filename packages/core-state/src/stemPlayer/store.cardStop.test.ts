import { describe, expect, it, vi } from 'vitest';

import { BARS, opened, stem } from './store.test-helper.ts';

const SET_ID = 7;

async function held() {
  const song = await opened([stem(1)]);
  const hold = song.store.getState().acquireSong(SET_ID, BARS);
  const cardStops = vi.fn();
  song.store.getState().onCardStop(cardStops);
  return { ...song, hold, cardStops };
}

describe('Stop on the song card', () => {
  it('ends a song no screen holds', async () => {
    const song = await held();
    song.hold.release();
    song.stopSongFromNotification();
    expect(song.store.getState().setId).toBeNull();
    expect(song.cardStops).toHaveBeenCalledOnce();
  });

  it('leaves the song on a screen that holds it', async () => {
    const song = await held();
    song.stopSongFromNotification();
    expect(song.store.getState().setId).toBe(SET_ID);
    expect(song.cardStops).toHaveBeenCalledOnce();
  });

  it('ends that song once its screen goes', async () => {
    const song = await held();
    song.stopSongFromNotification();
    song.hold.release();
    expect(song.store.getState().setId).toBeNull();
  });

  it('does not end a song played again before its screen goes', async () => {
    const song = await held();
    song.stopSongFromNotification();
    song.store.getState().togglePlay();
    song.engine.playing = true;
    song.hold.release();
    expect(song.store.getState().setId).toBe(SET_ID);
  });

  it('stops telling a listener that unsubscribed', async () => {
    const song = await opened([stem(1)]);
    const cardStops = vi.fn();
    song.store.getState().onCardStop(cardStops)();
    song.stopSongFromNotification();
    expect(cardStops).not.toHaveBeenCalled();
  });
});
