import { KB_MIXER_UNITY_RATE } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { UNSHIFTED_KEY } from './mix.ts';
import {
  BARS,
  opened,
  record,
  SONG_FRAMES,
  stem,
} from './store.test-helper.ts';

const NEXT_SET_ID = 8;
const PRACTICE_SPEED = 0.8;
const UP_TWO = 2;
const STORED_SPEED = 0.75;
const DOWN_ONE = -1;
const VOCALS = 0;
const BASS = 2;

const band = (key: number) => [
  stem(1, { name: 'vocals', role: 'vocals', pitch: key }),
  stem(2, { name: 'drums', role: 'drums', pitch: key }),
  stem(3, { name: 'bass', role: 'bass', pitch: key }),
];

async function practising() {
  const song = await opened(band(UP_TWO), {
    speed: PRACTICE_SPEED,
    pitch: UP_TWO,
  });
  song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  return song;
}

type Song = Awaited<ReturnType<typeof practising>>;

async function advanceTo(song: Song, speed: number, key: number) {
  song.endSong(SONG_FRAMES);
  vi.clearAllMocks();
  song.records.readStemSet.mockResolvedValueOnce(
    record(band(key), { id: NEXT_SET_ID, speed, pitch: key }),
  );
  expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe('playing');
}

describe('an advance from a song played at another speed and key', () => {
  it('plays a next song stored unshifted at full speed in its key', async () => {
    const song = await practising();
    await advanceTo(song, KB_MIXER_UNITY_RATE, UNSHIFTED_KEY);
    expect(song.engine.rate).toBe(KB_MIXER_UNITY_RATE);
    expect(song.commands.mixerSetTrackPitch).not.toHaveBeenCalled();
    const { speed, songKey, stems } = song.store.getState();
    expect({ speed, songKey }).toEqual({
      speed: KB_MIXER_UNITY_RATE,
      songKey: UNSHIFTED_KEY,
    });
    expect(stems.map((row) => row.key)).toEqual([0, 0, 0]);
    await song.store.getState().setSongKey(UP_TWO);
    expect(song.records.saveStemSetSpeedKey).toHaveBeenLastCalledWith(
      NEXT_SET_ID,
      expect.objectContaining({ speed: KB_MIXER_UNITY_RATE }),
    );
  });

  it('plays the next song at its own stored speed and key, drums untouched', async () => {
    const song = await practising();
    await advanceTo(song, STORED_SPEED, DOWN_ONE);
    expect(song.engine.rate).toBe(STORED_SPEED);
    expect(song.commands.mixerSetTrackPitch.mock.calls).toEqual([
      [VOCALS, DOWN_ONE],
      [BASS, DOWN_ONE],
    ]);
    expect(song.store.getState()).toMatchObject({
      setId: NEXT_SET_ID,
      speed: STORED_SPEED,
      songKey: DOWN_ONE,
    });
  });
});
