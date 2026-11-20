import { describe, expect, it, vi } from 'vitest';

import { ADVANCE_CAUSE } from './songEnd.ts';
import {
  at,
  BARS,
  opened,
  record,
  SONG_DETAILS,
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

async function playing() {
  const song = await opened([stem(1)]);
  const hold = song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  song.store.getState().togglePlay();
  song.engine.playing = true;
  song.engine.position = at(30);
  const left = vi.fn();
  song.store.getState().onSongEnd(left);
  return { ...song, hold, left };
}

type Song = Awaited<ReturnType<typeof playing>>;

function pressNext(song: Song, session?: number) {
  song.requestFromNotification({ action: 'next', frame: null }, session);
}

describe('Next on the song card', () => {
  it('starts the same advance as the end of the song, marked as a press', async () => {
    const song = await playing();
    pressNext(song);
    expect(song.left).toHaveBeenCalledExactlyOnceWith(ADVANCE_CAUSE.next);
    expect(song.store.getState().songStillEnded()).toBe(true);
  });

  it('shows the card in the play order, tagged with a session a new song replaces', async () => {
    const song = await playing();
    const first = song.commands.songTransportShow.mock.lastCall?.[0];
    expect(first?.inPlayOrder).toBe(true);
    song.store.getState().acquireSong(7, BARS);
    await vi.waitFor(() => {
      expect(song.store.getState().status).toBe('ready');
    });
    song.engine.playing = false;
    song.store.getState().togglePlay();
    const second = song.commands.songTransportShow.mock.lastCall?.[0];
    expect(second?.session).not.toBe(first?.session);
  });

  it('is ignored when pressed on the card of a song since replaced', async () => {
    const song = await playing();
    const shownFor = song.commands.songTransportShow.mock.lastCall?.[0].session;
    song.store.getState().acquireSong(7, BARS);
    pressNext(song, shownFor);
    expect(song.left).not.toHaveBeenCalled();
    expect(song.store.getState().songStillEnded()).toBe(false);
  });

  it('plays the next song and keeps the card up, though the song never ended', async () => {
    const song = await playing();
    song.commands.mixerStop.mockImplementation(() => {
      song.engine.playing = false;
    });
    pressNext(song);
    vi.clearAllMocks();
    song.records.readStemSet.mockResolvedValueOnce(nextSong);
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe('playing');
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
    expect(song.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Next', playing: true }),
    );
  });

  it('leaves the card alone when nothing turns out to be up next', async () => {
    const song = await playing();
    pressNext(song);
    vi.clearAllMocks();
    song.store.getState().stopAdvancing();
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
  });
});

describe('handing the card to a metronome song', () => {
  it('puts up the stopped metronome card before the song card goes', async () => {
    const song = await playing();
    vi.clearAllMocks();
    song.store.getState().handToMetronome();
    expect(song.sharedMetronome.showStopped).toHaveBeenCalledTimes(1);
    expect(song.commands.songTransportHide).toHaveBeenCalledTimes(1);
    expect(
      song.sharedMetronome.showStopped.mock.invocationCallOrder[0],
    ).toBeLessThan(
      song.commands.songTransportHide.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('closes the stem song and starts nothing', async () => {
    const song = await playing();
    vi.clearAllMocks();
    song.store.getState().handToMetronome();
    expect(song.store.getState().setId).toBeNull();
    expect(song.commands.mixerStop).toHaveBeenCalled();
    expect(song.commands.metronomeStart).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.hold.live()).toBe(false);
  });
});
