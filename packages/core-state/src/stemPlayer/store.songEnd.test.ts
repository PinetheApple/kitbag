import { describe, expect, it, vi } from 'vitest';

import {
  at,
  BARS,
  countingSong,
  opened,
  record,
  SONG_DETAILS,
  SONG_FRAMES,
  stem,
  TWO_FOUR,
} from './store.test-helper.ts';

const NEXT_SET_ID = 8;
const nextSong = record([stem(2)], {
  id: NEXT_SET_ID,
  title: 'Next',
  ...SONG_DETAILS,
  bars: TWO_FOUR,
});

type Song = Awaited<ReturnType<typeof opened>>;

async function acquired() {
  const song = await opened([stem(1)]);
  const hold = song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  return { ...song, hold };
}

function listening(song: Song) {
  const ended = vi.fn();
  song.store.getState().onSongEnd(ended);
  return ended;
}

function advance(song: Song, next = nextSong) {
  song.endSong(SONG_FRAMES);
  vi.clearAllMocks();
  song.records.readStemSet.mockResolvedValueOnce(next);
  return song.store.getState().advanceTo(next.id);
}

describe('the end of the open song', () => {
  it('is passed on when the song played onto its last frame', async () => {
    const song = await opened([stem(1)]);
    const ended = listening(song);
    song.endSong(SONG_FRAMES);
    expect(ended).toHaveBeenCalledTimes(1);
  });

  it('is dropped once the song plays again', async () => {
    const song = await opened([stem(1)]);
    const ended = listening(song);
    song.engine.position = SONG_FRAMES;
    song.engine.playing = true;
    song.songEndListeners.forEach((handler) => {
      handler();
    });
    expect(ended).not.toHaveBeenCalled();
  });

  it('is dropped away from the end, as for a song opened since', async () => {
    const song = await opened([stem(1)]);
    const ended = listening(song);
    song.endSong(at(1));
    expect(ended).not.toHaveBeenCalled();
  });

  it('is dropped while a count-in runs', async () => {
    const song = await countingSong();
    const ended = listening(song);
    song.store.getState().togglePlay();
    song.endSong(SONG_FRAMES);
    expect(ended).not.toHaveBeenCalled();
  });

  it('stops being listened to when the player closes', async () => {
    const song = await opened([stem(1)]);
    expect(song.songEndListeners.size).toBe(1);
    song.store.getState().close();
    expect(song.songEndListeners.size).toBe(0);
  });

  it('reaches a listener no longer once it unsubscribes', async () => {
    const song = await opened([stem(1)]);
    const ended = vi.fn();
    const unsubscribe = song.store.getState().onSongEnd(ended);
    unsubscribe();
    song.endSong(SONG_FRAMES);
    expect(ended).not.toHaveBeenCalled();
  });
});

function nextAdvance(song: Song) {
  song.records.readStemSet.mockResolvedValueOnce(nextSong);
  return song.store.getState().advanceTo(NEXT_SET_ID);
}

describe('a press between the end and the advance', () => {
  it('Play keeps the ended song', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    song.store.getState().togglePlay();
    song.engine.playing = true;
    expect(song.store.getState().songStillEnded()).toBe(false);
    expect(await nextAdvance(song)).toBe('displaced');
    expect(song.store.getState().setId).toBe(7);
  });

  it('a seek keeps it', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    song.store.getState().seek(at(1));
    song.engine.position = at(1);
    expect(await nextAdvance(song)).toBe('displaced');
  });

  it('a counted Play keeps it', async () => {
    const song = await acquired();
    song.countInBars.mockReturnValue(1);
    song.endSong(SONG_FRAMES);
    song.store.getState().togglePlay();
    expect(song.commands.songCountIn).toHaveBeenCalled();
    expect(await nextAdvance(song)).toBe('displaced');
  });

  it('a Stop from the notification keeps it', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    song.stopSongFromNotification();
    expect(await nextAdvance(song)).toBe('displaced');
  });
});

describe('a lyrics re-time recording', () => {
  it('holds the song where it ended', async () => {
    const song = await opened([stem(1)], SONG_DETAILS);
    const ended = listening(song);
    song.store.getState().beginRetime(0);
    song.endSong(SONG_FRAMES);
    expect(ended).not.toHaveBeenCalled();
    expect(song.store.getState().songStillEnded()).toBe(false);
  });
});

describe('the song card when the advance gives up', () => {
  it('goes once nothing after an unopened song plays', async () => {
    const song = await acquired();
    song.store.getState().togglePlay();
    song.endSong(SONG_FRAMES);
    vi.clearAllMocks();
    song.records.readStemSet.mockResolvedValueOnce(undefined);
    await song.store.getState().advanceTo(NEXT_SET_ID);
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
    song.store.getState().stopAdvancing();
    expect(song.commands.songTransportHide).toHaveBeenCalledTimes(1);
  });

  it('stays for the ended song that is still loaded', async () => {
    const song = await acquired();
    song.store.getState().togglePlay();
    song.endSong(SONG_FRAMES);
    vi.clearAllMocks();
    song.store.getState().stopAdvancing();
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
  });
});

describe('advancing to the next song', () => {
  it('opens and plays it under the hold the screen already has', async () => {
    const song = await acquired();
    expect(await advance(song)).toBe('playing');
    const state = song.store.getState();
    expect(state).toMatchObject({
      status: 'ready',
      setId: NEXT_SET_ID,
      title: 'Next',
      advancedTo: NEXT_SET_ID,
    });
    expect(song.commands.mixerPlay).toHaveBeenCalledTimes(1);
    expect(song.hold.live()).toBe(true);
  });

  it('keeps the song card up between the two songs', async () => {
    const song = await acquired();
    song.store.getState().togglePlay();
    await advance(song);
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
    expect(song.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Next', playing: true }),
    );
  });

  it('outlives the screen that held the song before it', async () => {
    const song = await acquired();
    await advance(song);
    song.hold.release();
    expect(song.store.getState().setId).toBe(NEXT_SET_ID);
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
  });

  it('counts in like a press of Play, and starts no click', async () => {
    const song = await acquired();
    song.countInBars.mockReturnValue(1);
    await advance(song);
    expect(song.commands.songCountIn).toHaveBeenCalledWith(
      expect.any(Number),
      expect.any(Number),
      TWO_FOUR[0]?.beatsPerBar,
      false,
    );
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
    const state = song.store.getState();
    expect(state).toMatchObject({
      click: false,
      countBeatsPerBar: TWO_FOUR[0]?.beatsPerBar,
    });
    expect(state.advanceCountEnd).toBe(state.countEndFrame);
  });

  it('turns off a click the ended song had on', async () => {
    const song = await acquired();
    await song.store.getState().toggleClick();
    await advance(song);
    expect(song.store.getState().click).toBe(false);
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
  });

  it('leaves a song that will not open stopped and says so', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    vi.clearAllMocks();
    song.records.readStemSet.mockResolvedValueOnce(undefined);
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe(
      'unplayable',
    );
    expect(song.store.getState().status).toBe('missing');
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('moves on from a song that would not open', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    song.records.readStemSet.mockResolvedValueOnce(undefined);
    await song.store.getState().advanceTo(NEXT_SET_ID);
    song.records.readStemSet.mockResolvedValueOnce(nextSong);
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe('playing');
  });

  it('opens nothing once the player closed after the song ended', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    song.store.getState().close();
    vi.clearAllMocks();
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe(
      'displaced',
    );
    expect(song.store.getState().setId).toBeNull();
    expect(song.records.readStemSet).not.toHaveBeenCalled();
  });

  it('leaves a song the screen opened after the end alone', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    void song.store.getState().open(7, BARS);
    vi.clearAllMocks();
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe(
      'displaced',
    );
    expect(song.records.readStemSet).not.toHaveBeenCalled();
  });

  it('opens nothing without a song end to advance from', async () => {
    const song = await acquired();
    vi.clearAllMocks();
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe(
      'displaced',
    );
    expect(song.records.readStemSet).not.toHaveBeenCalled();
  });

  it('gives way to a song opened while it loads', async () => {
    const song = await acquired();
    song.endSong(SONG_FRAMES);
    vi.clearAllMocks();
    song.records.readStemSet.mockResolvedValueOnce(nextSong);
    const advancing = song.store.getState().advanceTo(NEXT_SET_ID);
    const other = song.store.getState().acquireSong(7, BARS);
    expect(await advancing).toBe('displaced');
    expect(song.hold.live()).toBe(false);
    expect(other.live()).toBe(true);
  });

  it('is forgotten by a song the screen opens itself', async () => {
    const song = await acquired();
    await advance(song);
    await song.store.getState().open(7, BARS);
    expect(song.store.getState().advancedTo).toBeNull();
  });
});
