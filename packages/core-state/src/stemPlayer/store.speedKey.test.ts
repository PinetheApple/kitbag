import { KB_MIXER_UNITY_RATE, KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RETIME_PLAYBACK_RATE } from './retimeSpeed.ts';
import { opened, SONG_DETAILS, stem } from './store.test-helper.ts';

const STORED_SPEED = 0.8;
const PRACTICE_SPEED = 0.9;
const DOWN_TWO = -2;
const UP_ONE = 1;
const VOCALS = 0;
const DRUMS = 1;
const BASS = 2;

type Song = Awaited<ReturnType<typeof opened>>;

const band = (bass = 0) => [
  stem(1, { name: 'vocals', role: 'vocals' }),
  stem(2, { name: 'drums', role: 'drums' }),
  stem(3, { name: 'bass', role: 'bass', pitch: bass }),
];

const keysSent = ({ commands }: Pick<Song, 'commands'>) =>
  commands.mixerSetTrackPitch.mock.calls;

const ratesSet = ({ commands }: Pick<Song, 'commands'>) =>
  commands.mixerSetRate.mock.calls.map(([rate]) => rate);

const lastSaved = ({ records }: Pick<Song, 'records'>) =>
  records.saveStemSetSpeedKey.mock.calls.at(-1)?.[1];

const rowKeys = ({ store }: Song) => store.getState().stems.map((s) => s.key);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('opening a stem song', () => {
  it('plays at its stored speed and shows the BPM that plays', async () => {
    const song = await opened([stem(1)], { speed: STORED_SPEED, bpm: 120 });
    expect(song.commands.mixerSetRate.mock.calls).toEqual([[STORED_SPEED]]);
    expect(song.store.getState()).toMatchObject({
      speed: STORED_SPEED,
      facts: { bpm: { value: '96' } },
      recordedFacts: { bpm: { value: '120' } },
    });
  });

  it('sends every stored stem key again, never to drums', async () => {
    const stems = band(DOWN_TWO).map((row) => ({ ...row, pitch: DOWN_TWO }));
    const song = await opened(stems, { pitch: DOWN_TWO });
    expect(keysSent(song)).toEqual([
      [VOCALS, DOWN_TWO],
      [BASS, DOWN_TWO],
    ]);
    expect(song.store.getState().songKey).toBe(DOWN_TWO);
  });

  it('shows a stem key the mixer refused as unshifted', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const song = await opened(band(DOWN_TWO), {}, (fake) => {
      fake.commands.mixerSetTrackPitch.mockResolvedValue(
        KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
      );
    });
    expect(rowKeys(song)).toEqual([0, 0, 0]);
  });
});

describe('changing the speed', () => {
  it('plays the new speed and stores it', async () => {
    const song = await opened(band());
    await song.store.getState().setSpeed(PRACTICE_SPEED);
    expect(ratesSet(song)).toEqual([PRACTICE_SPEED]);
    expect(song.store.getState().speed).toBe(PRACTICE_SPEED);
    expect(lastSaved(song)).toMatchObject({ speed: PRACTICE_SPEED });
  });

  it('goes back to the speed playing when the mixer refuses', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const song = await opened(band());
    song.commands.mixerSetRate.mockResolvedValue(KB_RESULT.KB_ERROR_BUSY);
    await song.store.getState().setSpeed(PRACTICE_SPEED);
    expect(song.store.getState().speed).toBe(KB_MIXER_UNITY_RATE);
    expect(song.records.saveStemSetSpeedKey).not.toHaveBeenCalled();
  });

  it('puts back the chosen speed when a retime ends', async () => {
    const song = await opened(band(), SONG_DETAILS);
    await song.store.getState().setSpeed(PRACTICE_SPEED);
    song.store.getState().beginRetime(0);
    await vi.runAllTimersAsync();
    song.store.getState().cancelRetime();
    await vi.runAllTimersAsync();
    expect(ratesSet(song)).toEqual([
      PRACTICE_SPEED,
      RETIME_PLAYBACK_RATE,
      PRACTICE_SPEED,
    ]);
  });

  it('changes nothing while a retime runs', async () => {
    const song = await opened(band(), SONG_DETAILS);
    song.store.getState().beginRetime(0);
    await vi.runAllTimersAsync();
    await song.store.getState().setSpeed(PRACTICE_SPEED);
    await song.store.getState().setSongKey(UP_ONE);
    expect(ratesSet(song)).toEqual([RETIME_PLAYBACK_RATE]);
    expect(keysSent(song)).toEqual([]);
  });
});

describe('changing the key', () => {
  it('moves every stem that follows the song, leaves drums and set-apart stems', async () => {
    const song = await opened(band(UP_ONE));
    await song.store.getState().setSongKey(DOWN_TWO);
    expect(keysSent(song).slice(1)).toEqual([[VOCALS, DOWN_TWO]]);
    expect(rowKeys(song)).toEqual([DOWN_TWO, 0, UP_ONE]);
    expect(lastSaved(song)).toEqual({
      speed: KB_MIXER_UNITY_RATE,
      pitch: DOWN_TWO,
      stems: [
        { id: 1, pitch: DOWN_TWO },
        { id: 2, pitch: 0 },
        { id: 3, pitch: UP_ONE },
      ],
    });
  });

  it('shows the key that plays', async () => {
    const song = await opened(band(), { key: 'F', scale: 'major' });
    await song.store.getState().setSongKey(DOWN_TWO);
    expect(song.store.getState().facts.key?.text).toBe('E♭ maj');
    expect(song.store.getState().recordedFacts.key?.text).toBe('F maj');
  });

  it('sets one stem apart and back', async () => {
    const song = await opened(band());
    await song.store.getState().setStemKey(BASS, UP_ONE);
    expect(keysSent(song)).toEqual([[BASS, UP_ONE]]);
    await song.store.getState().setStemKey(BASS, 0);
    expect(rowKeys(song)).toEqual([0, 0, 0]);
  });

  it('never transposes drums, even asked directly', async () => {
    const song = await opened(band());
    await song.store.getState().setStemKey(DRUMS, UP_ONE);
    expect(keysSent(song)).toEqual([]);
  });

  it('keeps a stem the mixer refused at the key it plays', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const song = await opened(band());
    song.commands.mixerSetTrackPitch.mockImplementation((track) =>
      Promise.resolve(
        track === BASS ? KB_RESULT.KB_ERROR_BUSY : KB_RESULT.KB_OK,
      ),
    );
    await song.store.getState().setSongKey(DOWN_TWO);
    expect(rowKeys(song)).toEqual([DOWN_TWO, 0, 0]);
  });

  it('resets speed and every key, and leaves the mix alone', async () => {
    const song = await opened(band(UP_ONE), { speed: STORED_SPEED });
    song.store.getState().setGain(VOCALS, 0.5);
    await song.store.getState().resetSpeedKey();
    expect(ratesSet(song).at(-1)).toBe(KB_MIXER_UNITY_RATE);
    expect(keysSent(song).at(-1)).toEqual([BASS, 0]);
    expect(song.store.getState()).toMatchObject({
      speed: KB_MIXER_UNITY_RATE,
      songKey: 0,
    });
    expect(song.store.getState().stems[VOCALS]?.volume).toBe(0.5);
  });

  it('leaves speed and key alone on a mix reset', async () => {
    const song = await opened(band(UP_ONE), { speed: STORED_SPEED });
    song.store.getState().resetMix();
    expect(song.store.getState().speed).toBe(STORED_SPEED);
    expect(rowKeys(song)).toEqual([0, 0, UP_ONE]);
  });
});
