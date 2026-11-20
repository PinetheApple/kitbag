import type { LibraryRow } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { songRow } from '../storage/fixtures.test-helper.ts';
import {
  BARS,
  leftPlaying,
  opened,
  SONG_ID,
  songRecord,
} from './store.test-helper.ts';

const OTHER_SONG = SONG_ID + 1;
const RENAMED = 'Monkey Wrench';

function rename(
  library: Awaited<ReturnType<typeof opened>>['library'],
  title: string,
) {
  library.setState({
    rows: [songRow({ id: SONG_ID, title })] as readonly LibraryRow[],
  });
}

describe('Stop on the notification of a song left playing', () => {
  it('ends the session and lets the engine go', async () => {
    const left = await leftPlaying();
    left.stopSongFromNotification();
    expect(left.player.getState()).toMatchObject({
      songId: null,
      status: 'idle',
    });
    expect(left.commands.engineRelease).toHaveBeenCalledOnce();
    expect(left.songStopListeners.size).toBe(0);
  });

  it('ends the session of a paused song too', async () => {
    const left = await leftPlaying();
    left.player.getState().togglePlay();
    left.engine.playing = false;
    left.stopSongFromNotification();
    expect(left.player.getState()).toMatchObject({
      songId: null,
      status: 'idle',
    });
  });

  it('turns the click off', async () => {
    const left = await leftPlaying();
    await left.player.getState().toggleClick();
    left.commands.metronomeStop.mockClear();
    left.stopSongFromNotification();
    expect(left.player.getState().click).toBe(false);
    expect(left.commands.metronomeStop).toHaveBeenCalled();
  });

  it('leaves alone a song opened since, before it shows its own card', async () => {
    const left = await leftPlaying();
    const next = left.player.getState().open(OTHER_SONG, BARS);
    await next.loaded;
    await left.player.getState().toggleClick();
    left.stopSongFromNotification();
    expect(left.player.getState()).toMatchObject({
      songId: OTHER_SONG,
      status: 'ready',
      click: true,
    });
    expect(next.hold.live()).toBe(true);
  });
});

describe('a rename while the song plays on', () => {
  it('shows the new title on its card, playing as the engine reads', async () => {
    const left = await leftPlaying();
    left.engine.playing = false;
    left.commands.songTransportShow.mockClear();
    rename(left.library, RENAMED);
    expect(left.commands.songTransportShow).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ title: RENAMED, playing: false }),
    );
  });

  it('sends nothing when the card is not up', async () => {
    const { commands, library, player } = await opened(songRecord());
    rename(library, RENAMED);
    expect(player.getState().title).toBe(RENAMED);
    expect(commands.songTransportShow).not.toHaveBeenCalled();
  });
});

describe('closing the song in the app', () => {
  it('hides its card once', async () => {
    const left = await leftPlaying();
    left.player.getState().close();
    expect(left.commands.songTransportHide).toHaveBeenCalledOnce();
  });
});
