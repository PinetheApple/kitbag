import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import type { SongTransportShowState } from '@kitbag/core-native';

import { END_SLACK_SECONDS, SKIP_SECONDS } from './songTransport.ts';
import {
  at,
  BARS,
  countingSong,
  HEAD,
  opened,
  RATE,
  record,
  SONG_DETAILS,
  stem,
  TWO_FOUR,
} from './store.test-helper.ts';

const DURATION_FRAMES = 10 * RATE;
const NEXT_SET_ID = 8;
const NEXT_SECONDS = 20;
const NEXT_FRAMES = at(NEXT_SECONDS);
const nextSong = record(
  [stem(2, { frames: NEXT_FRAMES, durationSec: NEXT_SECONDS })],
  { ...SONG_DETAILS, bars: TWO_FOUR },
);

type Song = Awaited<ReturnType<typeof opened>>;

function expectHiddenBeforeTeardown({ commands }: Song, stop: Mock) {
  const hidden = commands.songTransportHide.mock.invocationCallOrder;
  const teardown = [
    ...stop.mock.invocationCallOrder,
    ...commands.mixerUnloadTrack.mock.invocationCallOrder,
  ];
  expect(hidden).toHaveLength(1);
  expect(stop).toHaveBeenCalledTimes(1);
  expect(commands.mixerUnloadTrack).toHaveBeenCalled();
  expect(Math.min(...teardown)).toBeGreaterThan(Math.max(...hidden));
}

function nextCard({ commands }: Song, countingIn: boolean) {
  const calls = commands.songTransportShow.mock.calls as [
    SongTransportShowState,
  ][];
  const index = calls.findIndex(([state]) => state.countingIn === countingIn);
  return {
    state: calls[index]?.[0],
    order: commands.songTransportShow.mock.invocationCallOrder[index],
  };
}

async function changeSong(song: Song) {
  vi.clearAllMocks();
  song.records.readStemSet.mockResolvedValueOnce(nextSong);
  await song.store.getState().open(NEXT_SET_ID, BARS);
}

const NEXT_CARD = {
  durationFrames: NEXT_FRAMES,
  restartFromFrame: NEXT_FRAMES - END_SLACK_SECONDS * RATE,
};

const OPENED_SESSION = 1;

describe('the song notification', () => {
  it('shows the song, its length and the skip step when play starts', async () => {
    const { commands, store } = await opened([stem(1)]);
    store.getState().togglePlay();
    expect(commands.songTransportShow).toHaveBeenCalledWith({
      session: OPENED_SESSION,
      inPlayOrder: true,
      playing: true,
      countingIn: false,
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
    await store.getState().open(7, BARS);
    await store.getState().toggleClick();
    store.getState().togglePlay();
    stopSongFromNotification();
    expect(commands.onSongStopped).toHaveBeenCalledTimes(1);
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
    const { songStopListeners, store } = await opened([stem(1)]);
    expect(songStopListeners.size).toBe(1);
    store.getState().close();
    expect(songStopListeners.size).toBe(0);
  });
});

describe('changing song with the card up', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('hides the old card before the old song stops and unloads, and sends the new card only on play', async () => {
    const song = await opened([stem(1)]);
    song.store.getState().togglePlay();
    await changeSong(song);
    expectHiddenBeforeTeardown(song, song.commands.mixerStop);
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
    song.store.getState().togglePlay();
    expect(song.commands.songTransportShow).toHaveBeenCalledTimes(1);
    expect(nextCard(song, false).state).toMatchObject(NEXT_CARD);
  });

  it('keeps that order when the new card comes from a count-in', async () => {
    const song = await countingSong();
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    await changeSong(song);
    await vi.runAllTimersAsync();
    expectHiddenBeforeTeardown(song, song.commands.songStop);
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
    song.engine.position = HEAD;
    song.store.getState().togglePlay();
    await vi.runAllTimersAsync();
    const counted = nextCard(song, true);
    expect(counted.state).toMatchObject(NEXT_CARD);
    expect(counted.order).toBeGreaterThan(
      Math.max(...song.commands.songTransportHide.mock.invocationCallOrder),
    );
  });
});

describe('while the next song loads', () => {
  async function loadingNext() {
    const song = await opened([stem(1)]);
    vi.clearAllMocks();
    song.records.readStemSet.mockReturnValueOnce(new Promise(() => undefined));
    void song.store.getState().open(NEXT_SET_ID, BARS);
    await Promise.resolve();
    return song;
  }

  it('play does nothing and sends no card', async () => {
    const song = await loadingNext();
    expect(song.store.getState().status).toBe('loading');
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
  });

  it('pause still stops a mixer that is playing', async () => {
    const song = await loadingNext();
    song.engine.playing = true;
    song.store.getState().togglePlay();
    expect(song.commands.mixerPause).toHaveBeenCalledTimes(1);
  });

  it('a notification play or seek does nothing', async () => {
    const song = await loadingNext();
    song.requestFromNotification({ action: 'play', frame: null });
    song.requestFromNotification({ action: 'seek', frame: at(1) });
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
  });
});
