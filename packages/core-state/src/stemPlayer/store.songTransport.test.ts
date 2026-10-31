import { describe, expect, it } from 'vitest';

import { END_SLACK_SECONDS, SKIP_SECONDS } from './songTransport.ts';
import { opened, RATE, record, stem } from './store.test-helper.ts';

const DURATION_FRAMES = 10 * RATE;

describe('the song notification', () => {
  it('shows the song, its length and the skip step when play starts', async () => {
    const { commands, store } = await opened([stem(1)]);
    store.getState().togglePlay();
    expect(commands.songTransportShow).toHaveBeenCalledWith({
      playing: true,
      title: 'Song',
      artist: null,
      durationFrames: DURATION_FRAMES,
      restartFromFrame: DURATION_FRAMES - END_SLACK_SECONDS * RATE,
      skipSeconds: SKIP_SECONDS,
    });
  });

  it('names the artist when the bundle knows the song', async () => {
    const { commands, records, store } = await opened([stem(1)]);
    const known = {
      ...record([stem(1)]),
      songTitle: 'Blackbird',
      artist: 'The Beatles',
    };
    records.readStemSet.mockResolvedValueOnce(known);
    await store.getState().open(7, 1);
    store.getState().togglePlay();
    expect(commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Blackbird', artist: 'The Beatles' }),
    );
  });

  it('is left to the engine on pause, which the notification reads itself', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    engine.playing = true;
    store.getState().togglePlay();
    expect(commands.mixerPause).toHaveBeenCalledTimes(1);
    expect(commands.songTransportShow).not.toHaveBeenCalled();
    expect(commands.songTransportHide).not.toHaveBeenCalled();
  });

  it('ends when the player closes', async () => {
    const { commands, store } = await opened([stem(1)]);
    store.getState().togglePlay();
    store.getState().close();
    expect(commands.songTransportHide).toHaveBeenCalledTimes(1);
    expect(commands.mixerStop).toHaveBeenCalledTimes(1);
  });

  it('stays the only notification with the click joined to the stems', async () => {
    const { commands, sharedMetronome, store } = await opened([stem(1)]);
    sharedMetronome.active.mockReturnValue(true);
    await store.getState().toggleClick();
    store.getState().togglePlay();
    expect(sharedMetronome.release).toHaveBeenCalledTimes(1);
    expect(commands.metronomeFollowMixer).toHaveBeenCalledWith(true);
    expect(commands.songTransportShow).toHaveBeenCalledTimes(1);
  });

  it('stopping the song from it ends the joined click', async () => {
    const { commands, store, stopSongFromNotification } = await opened([
      stem(1),
    ]);
    await store.getState().toggleClick();
    store.getState().togglePlay();
    stopSongFromNotification();
    expect(store.getState().click).toBe(false);
    expect(commands.metronomeFollowMixer).toHaveBeenLastCalledWith(false);
    expect(commands.clearGrid).toHaveBeenCalledTimes(1);
    expect(commands.metronomeStop).toHaveBeenCalledTimes(1);
  });

  it('stopping the song from it leaves a click that was off alone', async () => {
    const { commands, store, stopSongFromNotification } = await opened([
      stem(1),
    ]);
    store.getState().togglePlay();
    stopSongFromNotification();
    expect(store.getState().click).toBe(false);
    expect(commands.metronomeStop).not.toHaveBeenCalled();
  });

  it('is not listened to once the player closes', async () => {
    const { commands, store, stopSongFromNotification } = await opened([
      stem(1),
    ]);
    await store.getState().toggleClick();
    store.getState().close();
    commands.metronomeStop.mockClear();
    stopSongFromNotification();
    expect(commands.metronomeStop).not.toHaveBeenCalled();
  });
});
