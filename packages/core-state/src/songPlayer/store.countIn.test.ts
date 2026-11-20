import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { KB_COUNT_IN_OFF } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COUNT_IN_DRAIN_MARGIN_SECONDS } from '../stemPlayer/countedStart.ts';
import { at } from '../stemPlayer/store.test-helper.ts';
import { openedSong, SONG_ID, songRecord } from './store.test-helper.ts';

const ONE_BAR = 1;
const TWO_BARS = 2;
const BAR_BEATS = 4;
const BEAT = 0.5;
const MID_SONG = at(1.2);
const SONG_END = at(10);
const LATE_DOWNBEAT = 2;
const countEnd = (bars: number) =>
  at(COUNT_IN_DRAIN_MARGIN_SECONDS) + bars * BAR_BEATS * at(BEAT);

type Song = Awaited<ReturnType<typeof openedSong>>;

async function songWithCountIn(
  bars: number = ONE_BAR,
  { click = true, record = songRecord() } = {},
): Promise<Song> {
  const song = await openedSong(record);
  song.store.getState().setClickCountIn(bars);
  if (click) await song.store.getState().toggleClick();
  vi.clearAllMocks();
  return song;
}

async function counting(): Promise<Song> {
  const song = await songWithCountIn();
  song.store.getState().togglePlay();
  await vi.runAllTimersAsync();
  return song;
}

const counts = ({ commands }: Song) => commands.songCountIn.mock.calls;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('play from the start with a count-in', () => {
  it('counts the bars in, then starts the song where the count ends', async () => {
    const song = await counting();
    expect(song.commands.mixerSeek.mock.calls).toEqual([[0]]);
    expect(counts(song)).toEqual([
      [countEnd(ONE_BAR), at(BEAT), BAR_BEATS, true],
    ]);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBe(countEnd(ONE_BAR));
  });

  it("counts the song's own number of bars", async () => {
    const song = await songWithCountIn(TWO_BARS);
    song.store.getState().togglePlay();
    expect(counts(song)[0]?.[0]).toBe(countEnd(TWO_BARS));
  });

  it('starts the song on its first downbeat', async () => {
    const song = await songWithCountIn(ONE_BAR, {
      record: songRecord({
        downbeatIndices: [LATE_DOWNBEAT, LATE_DOWNBEAT + BAR_BEATS],
      }),
    });
    song.store.getState().togglePlay();
    expect(song.commands.mixerSeek.mock.calls).toEqual([
      [at(LATE_DOWNBEAT * BEAT)],
    ]);
    expect(counts(song)).toHaveLength(1);
  });

  it('counts in with the click off, keeping the click off after', async () => {
    const song = await songWithCountIn(ONE_BAR, { click: false });
    song.store.getState().togglePlay();
    expect(counts(song)).toEqual([
      [countEnd(ONE_BAR), at(BEAT), BAR_BEATS, false],
    ]);
  });

  it('counts in again when play starts the song over from its end', async () => {
    const song = await songWithCountIn();
    song.engine.position = SONG_END;
    song.store.getState().togglePlay();
    expect(counts(song)).toHaveLength(1);
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('plays at once when the count-in is off', async () => {
    const song = await songWithCountIn(KB_COUNT_IN_OFF);
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });
});

describe('play after a pause', () => {
  it('resumes at once without counting in', async () => {
    const song = await songWithCountIn();
    song.engine.position = MID_SONG;
    song.store.getState().togglePlay();
    expect(song.commands.mixerPlay).toHaveBeenCalledOnce();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
    expect(song.commands.mixerSeek).not.toHaveBeenCalled();
  });
});

describe('during the count', () => {
  it('pause cancels it and the song does not start', async () => {
    const song = await counting();
    song.store.getState().togglePlay();
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().countEndFrame).toBeNull();
  });

  it('re-counts in the new meter when the grid is replaced', async () => {
    const song = await counting();
    song.store.getState().meterOverrideChanged(SONG_ID, {
      ...NO_METER_OVERRIDE,
      meterBeatsPerBar: GRID_METER.triple,
    });
    await vi.runAllTimersAsync();
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(counts(song).map((call) => call[2])).toEqual([
      BAR_BEATS,
      GRID_METER.triple,
    ]);
  });

  it('a pause from the notification cancels it', async () => {
    const song = await counting();
    song.requestFromNotification({ action: 'pause', frame: null });
    expect(song.commands.songPause).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });

  it('shows the count on the notification', async () => {
    const song = await counting();
    expect(song.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ countingIn: true, playing: true }),
    );
  });

  it('a stop from the notification ends the song unstarted', async () => {
    const song = await counting();
    song.requestFromNotification({ action: 'stop', frame: null });
    song.stopSongFromNotification();
    expect(song.commands.songStop).toHaveBeenCalledOnce();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.store.getState().songId).toBeNull();
  });
});
