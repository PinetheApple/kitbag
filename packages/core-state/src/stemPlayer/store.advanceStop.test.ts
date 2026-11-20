import { describe, expect, it, vi } from 'vitest';

import { ADVANCE_OUTCOME } from './songEnd.ts';
import {
  BARS,
  opened,
  record,
  SONG_DETAILS,
  SONG_FRAMES,
  stem,
  TWO_FOUR,
} from './store.test-helper.ts';

const NEXT_SET_ID = 8;
const PAUSE = { action: 'pause', frame: null } as const;
const nextSong = record([stem(2)], {
  id: NEXT_SET_ID,
  title: 'Next',
  ...SONG_DETAILS,
  bars: TWO_FOUR,
});

async function advancing() {
  const song = await opened([stem(1)]);
  song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  song.store.getState().togglePlay();
  song.countInBars.mockReturnValue(1);
  song.endSong(SONG_FRAMES);
  vi.clearAllMocks();
  song.records.readStemSet.mockResolvedValueOnce(nextSong);
  const outcome = song.store.getState().advanceTo(NEXT_SET_ID);
  return { ...song, outcome };
}

describe('a card Stop while the next song opens', () => {
  it('opens the next song without starting it or its count-in', async () => {
    const song = await advancing();
    song.stopSongFromNotification();
    expect(await song.outcome).toBe(ADVANCE_OUTCOME.stopped);
    expect(song.store.getState()).toMatchObject({
      status: 'ready',
      setId: NEXT_SET_ID,
      countEndFrame: null,
    });
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
  });

  it('leaves the card to the engine, neither showing nor hiding it', async () => {
    const song = await advancing();
    song.stopSongFromNotification();
    await song.outcome;
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
  });

  it('lets the next song play from a press once it has opened', async () => {
    const song = await advancing();
    song.stopSongFromNotification();
    await song.outcome;
    song.store.getState().togglePlay();
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });
});

describe('the next song opening without a Stop', () => {
  it('starts as before', async () => {
    const song = await advancing();
    expect(await song.outcome).toBe(ADVANCE_OUTCOME.playing);
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });

  it('starts despite a Stop on the song that ended, before the advance', async () => {
    const song = await advancing();
    await song.outcome;
    song.stopSongFromNotification();
    song.endSong(SONG_FRAMES);
    vi.clearAllMocks();
    song.records.readStemSet.mockResolvedValueOnce(nextSong);
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe(
      ADVANCE_OUTCOME.playing,
    );
  });

  it('starts despite a Pause, which the card sends only during a count', async () => {
    const song = await advancing();
    song.requestFromNotification(PAUSE);
    expect(await song.outcome).toBe(ADVANCE_OUTCOME.playing);
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });
});
