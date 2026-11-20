import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

import { BARS, opened, SONG_FRAMES, stem } from './store.test-helper.ts';

const SET_ID = 7;
const NEXT_SET_ID = 9;

async function held() {
  const song = await opened([stem(1)]);
  const hold = song.store.getState().acquireSong(SET_ID, BARS);
  const cardStops = vi.fn();
  song.store.getState().onCardStop(cardStops);
  return { ...song, hold, cardStops };
}

describe('an advance with no screen holding the song', () => {
  it.each([
    ['missing', () => Promise.resolve(undefined)],
    ['failed', () => Promise.reject(new Error('locked'))],
  ] as const)(
    'closes the session when the next song ends %s',
    async (status, read) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const song = await held();
      song.hold.release();
      song.endSong(SONG_FRAMES);
      song.records.readStemSet.mockImplementationOnce(read);
      await song.store.getState().advanceTo(NEXT_SET_ID);
      expect(song.store.getState().status).toBe(status);
      song.store.getState().stopAdvancing();
      expect(song.store.getState().setId).toBeNull();
      expect(song.commands.engineRelease).toHaveBeenCalledOnce();
      expect(song.commands.songTransportHide).toHaveBeenCalledOnce();
    },
  );

  it('leaves a failed advance open while a screen holds it', async () => {
    const song = await held();
    song.endSong(SONG_FRAMES);
    song.records.readStemSet.mockResolvedValueOnce(undefined);
    await song.store.getState().advanceTo(NEXT_SET_ID);
    song.store.getState().stopAdvancing();
    expect(song.store.getState().setId).toBe(NEXT_SET_ID);
    expect(song.commands.engineRelease).not.toHaveBeenCalled();
  });
});

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
