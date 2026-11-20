import { describe, expect, it, vi } from 'vitest';

import { BARS, at, opened, stem } from './store.test-helper.ts';

const PREVIOUS = { action: 'previous', frame: null } as const;

async function playing() {
  const song = await opened([stem(1)]);
  song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  song.store.getState().togglePlay();
  song.engine.playing = true;
  song.engine.position = at(30);
  const back = vi.fn();
  song.store.getState().onPrevious(back);
  return { ...song, back };
}

describe('Previous on a stem song', () => {
  it('passes the card press to the play order, marked as from the card', async () => {
    const song = await playing();
    song.requestFromNotification(PREVIOUS);
    expect(song.back).toHaveBeenCalledExactlyOnceWith(false);
    expect(song.commands.mixerSeek).not.toHaveBeenCalledWith(0);
  });

  it('passes the in-app press to the play order, marked as in the app', async () => {
    const song = await playing();
    song.store.getState().pressPrevious();
    expect(song.back).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('ignores a press on the card of a song since replaced', async () => {
    const song = await playing();
    const shownFor = song.commands.songTransportShow.mock.lastCall?.[0].session;
    void song.store.getState().open(7, BARS);
    song.requestFromNotification(PREVIOUS, shownFor);
    expect(song.back).not.toHaveBeenCalled();
  });
});
