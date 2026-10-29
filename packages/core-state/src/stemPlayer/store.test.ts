import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createStemPlayerStore } from './store.ts';
import {
  BARS,
  fakeRuntime,
  opened,
  RATE,
  record,
  SAVE_MS,
  SEEK_MS,
  stem,
} from './store.test-helper.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('opening a stem song', () => {
  it.each([
    ['the stem set cannot be read', 'readStemSet'],
    ['the engine does not start', 'start'],
  ] as const)('shows a failure when %s', async (_, failing) => {
    const fake = fakeRuntime(record([stem(1)]));
    if (failing === 'readStemSet')
      fake.records.readStemSet.mockRejectedValueOnce(new Error('locked'));
    else fake.commands.start.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    const store = createStemPlayerStore(() => fake.runtime);
    await store.getState().open(7, BARS);
    expect(store.getState().status).toBe('failed');
    expect(fake.commands.loadTrack).not.toHaveBeenCalled();
  });

  it('loads nothing for a song left while its old loop was being cleared', async () => {
    const fake = fakeRuntime(record([stem(1)]));
    let cleared: (code: number) => void = () => undefined;
    fake.commands.mixerClearLoop.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          cleared = resolve;
        }),
    );
    const store = createStemPlayerStore(() => fake.runtime);
    const opening = store.getState().open(7, BARS);
    await vi.waitFor(() => {
      expect(fake.commands.mixerClearLoop).toHaveBeenCalled();
    });
    store.getState().close();
    cleared(KB_RESULT.KB_OK);
    await opening;
    expect(fake.commands.loadTrack).not.toHaveBeenCalled();
  });

  it('stops the metronome tool before it takes the shared metronome', async () => {
    const fake = fakeRuntime(record([stem(1)]));
    fake.sharedMetronome.active.mockReturnValue(true);
    const store = createStemPlayerStore(() => fake.runtime);
    await store.getState().open(7, BARS);
    expect(fake.sharedMetronome.release).toHaveBeenCalledTimes(1);
  });

  it('heads the screen with the song title and artist when the bundle has them', async () => {
    const fake = fakeRuntime({
      ...record([stem(1)]),
      title: 'Charity Gayle - Echo',
      songTitle: 'Echo',
      artist: 'Charity Gayle',
    });
    const store = createStemPlayerStore(() => fake.runtime);
    await store.getState().open(7, BARS);
    expect([store.getState().title, store.getState().artist]).toEqual([
      'Echo',
      'Charity Gayle',
    ]);
    const plain = fakeRuntime({ ...record([stem(1)]), title: 'Song' });
    const other = createStemPlayerStore(() => plain.runtime);
    await other.getState().open(7, BARS);
    expect([other.getState().title, other.getState().artist]).toEqual([
      'Song',
      null,
    ]);
  });

  it('scales each waveform to its stem against the longest', async () => {
    const { store } = await opened([stem(1), stem(2, { durationSec: 5 })]);
    expect(store.getState().stems.map((row) => row.extent)).toEqual([1, 0.5]);
  });

  it('loads every stem in order and applies the bundle mix to it', async () => {
    const { commands, store } = await opened([
      stem(1, { volume: 0.5 }),
      stem(2, { muted: true }),
      stem(3, { soloed: true }),
    ]);
    expect(commands.loadTrack.mock.calls).toEqual([
      [0, 'stems/job/stem-1.flac'],
      [1, 'stems/job/stem-2.flac'],
      [2, 'stems/job/stem-3.flac'],
    ]);
    expect(commands.mixerSetGain.mock.calls).toEqual([
      [0, 0.5],
      [1, 1],
      [2, 1],
    ]);
    expect(commands.mixerSetMute.mock.calls).toEqual([
      [0, false],
      [1, true],
      [2, false],
    ]);
    expect(commands.mixerSetSolo.mock.calls).toEqual([
      [0, false],
      [1, false],
      [2, true],
    ]);
    expect(store.getState()).toMatchObject({
      status: 'ready',
      engineRate: RATE,
      durationFrames: RATE * 10,
    });
  });

  it('caps the tracks at the mixer limit and reports the rest', async () => {
    const many = Array.from({ length: 18 }, (_, i) => stem(i + 1));
    const { commands, store } = await opened(many);
    expect(commands.loadTrack).toHaveBeenCalledTimes(16);
    expect(store.getState().overLimit).toBe(2);
  });

  it('marks a stem that would not load and sends it no mix', async () => {
    const fake = fakeRuntime(record([stem(1), stem(2)]));
    fake.commands.loadTrack.mockImplementation((track) =>
      Promise.resolve<number>(
        track === 1 ? KB_RESULT.KB_ERROR_INVALID_ARGUMENT : KB_RESULT.KB_OK,
      ),
    );
    const store = createStemPlayerStore(() => fake.runtime);
    await store.getState().open(7, BARS);
    expect(store.getState().stems.map((row) => row.loaded)).toEqual([
      true,
      false,
    ]);
    expect(fake.commands.mixerSetGain.mock.calls).toEqual([[0, 1]]);
  });
});

describe('mix changes', () => {
  it('turns many changes into one write of the latest values', async () => {
    const { records, store } = await opened([stem(1), stem(2)]);
    const { setGain, toggleMute } = store.getState();
    for (let step = 1; step <= 30; step++) setGain(0, step / 20);
    toggleMute(1);
    expect(records.saveStemMix).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SAVE_MS);
    expect(records.saveStemMix).toHaveBeenCalledTimes(1);
    expect(records.saveStemMix).toHaveBeenCalledWith([
      { id: 1, volume: 1.5, muted: false, soloed: false },
      { id: 2, volume: 1, muted: true, soloed: false },
    ]);
  });

  it('solos exclusively on a tap and additively on a long press', async () => {
    const { commands, store } = await opened([stem(1), stem(2), stem(3)]);
    commands.mixerSetSolo.mockClear();
    store.getState().solo(0, false);
    store.getState().solo(2, true);
    expect(store.getState().stems.map((row) => row.soloed)).toEqual([
      true,
      false,
      true,
    ]);
    store.getState().solo(1, false);
    expect(store.getState().stems.map((row) => row.soloed)).toEqual([
      false,
      true,
      false,
    ]);
    expect(commands.mixerSetSolo.mock.calls).toEqual([
      [0, true],
      [2, true],
      [0, false],
      [1, true],
      [2, false],
    ]);
  });
});

describe('mute and solo on one stem', () => {
  it('unmutes a muted stem that is soloed, on a tap or a long press', async () => {
    const { commands, store } = await opened([
      stem(1, { muted: true }),
      stem(2, { muted: true }),
      stem(3, { muted: true }),
    ]);
    vi.clearAllMocks();
    store.getState().solo(0, false);
    store.getState().solo(1, true);
    expect(store.getState().stems.map((r) => [r.muted, r.soloed])).toEqual([
      [false, true],
      [false, true],
      [true, false],
    ]);
    expect(commands.mixerSetMute.mock.calls).toEqual([
      [0, false],
      [1, false],
    ]);
  });

  it('un-solos a soloed stem that is muted and leaves the other solos', async () => {
    const { commands, store } = await opened([
      stem(1, { soloed: true }),
      stem(2, { soloed: true }),
    ]);
    vi.clearAllMocks();
    store.getState().toggleMute(0);
    expect(store.getState().stems.map((r) => [r.muted, r.soloed])).toEqual([
      [true, false],
      [false, true],
    ]);
    expect(commands.mixerSetSolo.mock.calls).toEqual([[0, false]]);
    expect(commands.mixerSetMute.mock.calls).toEqual([[0, true]]);
  });
});

describe('reset mix', () => {
  it('puts every stem and the master back to 0 dB, unmuted, unsoloed, and saves it', async () => {
    const { commands, records, store } = await opened([
      stem(1, { volume: 0.4, muted: true }),
      stem(2, { soloed: true }),
    ]);
    store.getState().setMasterGain(0.3);
    vi.clearAllMocks();
    store.getState().resetMix();
    expect(
      store.getState().stems.map((r) => [r.volume, r.muted, r.soloed]),
    ).toEqual([
      [1, false, false],
      [1, false, false],
    ]);
    expect(store.getState().masterGain).toBe(1);
    expect(commands.mixerSetGain.mock.calls).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(commands.mixerSetMute.mock.calls).toEqual([
      [0, false],
      [1, false],
    ]);
    expect(commands.mixerSetSolo.mock.calls).toEqual([
      [0, false],
      [1, false],
    ]);
    expect(commands.mixerSetMasterGain).toHaveBeenCalledWith(1);
    await vi.advanceTimersByTimeAsync(SAVE_MS);
    expect(records.saveStemMix).toHaveBeenCalledWith([
      { id: 1, volume: 1, muted: false, soloed: false },
      { id: 2, volume: 1, muted: false, soloed: false },
    ]);
  });
});

describe('transport', () => {
  it('debounces a scrub into one seek and seeks at once on release', async () => {
    const { commands, store } = await opened([stem(1)]);
    for (let frame = 0; frame < 10; frame++)
      store.getState().scrub(frame * RATE);
    await vi.advanceTimersByTimeAsync(SEEK_MS);
    expect(commands.mixerSeek.mock.calls).toEqual([[9 * RATE]]);
    store.getState().scrub(RATE);
    store.getState().seek(2 * RATE);
    await vi.advanceTimersByTimeAsync(SEEK_MS);
    expect(commands.mixerSeek.mock.calls.slice(1)).toEqual([[2 * RATE]]);
  });

  it('drops the pending seek of a scrub that was cancelled', async () => {
    const { commands, store } = await opened([stem(1)]);
    store.getState().scrub(3 * RATE);
    store.getState().cancelScrub();
    await vi.advanceTimersByTimeAsync(SEEK_MS);
    expect(commands.mixerSeek).not.toHaveBeenCalled();
  });

  it('pauses rather than stops when the engine is playing', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    engine.playing = true;
    store.getState().togglePlay();
    expect(commands.mixerPause).toHaveBeenCalledTimes(1);
    expect(commands.mixerStop).not.toHaveBeenCalled();
  });

  it('starts over from the top when play is pressed at the end', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    engine.position = 10 * RATE;
    store.getState().togglePlay();
    expect(commands.mixerSeek).toHaveBeenCalledWith(0);
    expect(commands.mixerPlay).toHaveBeenCalledTimes(1);
    engine.position = 4 * RATE;
    store.getState().togglePlay();
    expect(commands.mixerSeek).toHaveBeenCalledTimes(1);
  });
});

describe('§13.3 no realtime values in the store', () => {
  it('keeps the mixer position and playing flag out of state', async () => {
    const { store } = await opened([stem(1)]);
    const keys = Object.keys(store.getState());
    for (const name of ['mixerPosition', 'mixerPlaying', 'position', 'playing'])
      expect(keys).not.toContain(name);
  });
});

describe('the click', () => {
  it('starts once however often it is tapped while the grid loads', async () => {
    const { commands, store } = await opened([stem(1)]);
    let answer: (code: number) => void = () => undefined;
    commands.setGrid.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    const first = store.getState().toggleClick();
    const second = store.getState().toggleClick();
    answer(KB_RESULT.KB_OK);
    await Promise.all([first, second]);
    expect(commands.setGrid).toHaveBeenCalledTimes(1);
    expect(commands.metronomeStart).toHaveBeenCalledTimes(1);
    expect(store.getState().click).toBe(true);
  });

  it('never starts for a song closed while its grid loaded', async () => {
    const { commands, store } = await opened([stem(1)]);
    let answer: (code: number) => void = () => undefined;
    commands.setGrid.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          answer = resolve;
        }),
    );
    const pending = store.getState().toggleClick();
    store.getState().close();
    await store.getState().open(7, BARS);
    answer(KB_RESULT.KB_OK);
    await pending;
    expect(commands.metronomeStart).not.toHaveBeenCalled();
    expect(store.getState().click).toBe(false);
  });
});

describe('leaving the screen', () => {
  it('stops, turns the click off, clears every track and saves the mix', async () => {
    const { commands, records, store } = await opened([stem(1), stem(2)]);
    await store.getState().toggleClick();
    expect(commands.metronomeFollowMixer).toHaveBeenLastCalledWith(true);
    store.getState().toggleMute(0);
    commands.mixerSetSolo.mockClear();
    store.getState().close();
    expect(commands.metronomeFollowMixer).toHaveBeenLastCalledWith(false);
    expect(commands.clearGrid).toHaveBeenCalledTimes(1);
    expect(commands.metronomeStop).toHaveBeenCalledTimes(1);
    expect(commands.mixerStop).toHaveBeenCalledTimes(1);
    expect(commands.mixerSetSolo.mock.calls).toEqual([
      [0, false],
      [1, false],
    ]);
    expect(commands.mixerUnloadTrack.mock.calls).toEqual([[0], [1]]);
    expect(records.saveStemMix).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe('idle');
  });
});
