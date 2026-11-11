import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MetronomeCommands } from '../metronome/commands.ts';
import {
  createMetronomeStore,
  type MetronomeStore,
} from '../metronome/store.ts';
import { createSongPlayerStore } from '../songPlayer/store.ts';
import {
  BARS,
  fakeSongRuntime,
  SEEK_MS,
  SONG_ID,
  songRecord,
} from '../songPlayer/store.test-helper.ts';
import { createMixerClaim, type MixerClaim } from './mixerClaim.ts';
import { createMixerClick, type MixerClick } from './mixerClick.ts';
import { createStemPlayerStore } from './store.ts';
import {
  BARS as STEM_BARS,
  fakeRuntime as fakeStemRuntime,
  record,
  SAVE_MS,
  stem,
} from './store.test-helper.ts';

const STEM_SET_ID = 7;
const STANDALONE_BPM = 97;
const STANDALONE_BEATS = 3;
const STANDALONE_DENOMINATOR = 8;
const NOW_FRAME = 0;
const SONG_TITLE = songRecord().title;

type MixerCommands = ReturnType<typeof fakeStemRuntime>['commands'];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function standaloneOver(commands: MixerCommands, songClick: MixerClick) {
  const metronomeCommands = new Proxy(commands, {
    get: (target, name) =>
      (Reflect.get(target, name) as unknown) ?? (() => undefined),
  }) as unknown as MetronomeCommands;
  const store = createMetronomeStore(
    metronomeCommands,
    () => NOW_FRAME,
    () => STANDALONE_BPM,
    Date.now,
    songClick,
  );
  store.getState().setTempo(STANDALONE_BPM);
  store.getState().setBeats(STANDALONE_BEATS, STANDALONE_DENOMINATOR);
  return store;
}

function configOf(state: MetronomeStore) {
  return { ...state, running: undefined, practice: undefined };
}

async function openedSongClick(
  songClick: MixerClick = createMixerClick(),
  claim: MixerClaim = createMixerClaim(),
) {
  const fake = fakeSongRuntime(songRecord());
  const song = createSongPlayerStore(() => fake.runtime, {
    scrubSeekDelayMs: SEEK_MS,
    mixerClaim: claim,
    mixerClick: songClick,
  });
  await song.getState().open(SONG_ID, BARS).loaded;
  const standalone = standaloneOver(fake.commands, songClick);
  return { fake, song, standalone, songClick };
}

function stemStore(
  songClick: MixerClick,
  claim: MixerClaim = createMixerClaim(),
) {
  const fake = fakeStemRuntime(record([stem(1)]));
  const stems = createStemPlayerStore(() => fake.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
    mixerClaim: claim,
    mixerClick: songClick,
  });
  return { fake, stems };
}

function holdSetGrid(commands: MixerCommands): () => void {
  let gridSet: (result: number) => void = () => undefined;
  commands.setGrid.mockImplementationOnce(
    () =>
      new Promise<number>((resolve) => {
        gridSet = resolve;
      }),
  );
  return () => {
    gridSet(KB_RESULT.KB_OK);
  };
}

async function songWithClick() {
  const { fake, song, standalone, songClick } = await openedSongClick();
  await song.getState().toggleClick();
  vi.clearAllMocks();
  return { commands: fake.commands, song, standalone, songClick };
}

async function stemsWithClick() {
  const songClick = createMixerClick();
  const { fake, stems } = stemStore(songClick);
  await stems.getState().open(STEM_SET_ID, STEM_BARS);
  const standalone = standaloneOver(fake.commands, songClick);
  await stems.getState().toggleClick();
  vi.clearAllMocks();
  return { commands: fake.commands, stems, standalone, songClick };
}

function lastCall(mock: { mock: { invocationCallOrder: number[] } }): number {
  return mock.mock.invocationCallOrder.at(-1) ?? 0;
}

function expectReleasedBeforeStart(commands: MixerCommands) {
  expect(commands.metronomeFollowMixer).toHaveBeenCalledWith(false);
  expect(commands.clearGrid).toHaveBeenCalledOnce();
  const start = lastCall(commands.metronomeStart);
  expect(lastCall(commands.metronomeFollowMixer)).toBeLessThan(start);
  expect(lastCall(commands.clearGrid)).toBeLessThan(start);
}

describe("standalone Play while a song's click runs", () => {
  it('releases the song click before the standalone starts', async () => {
    const { commands, standalone } = await songWithClick();
    standalone.getState().start();
    expectReleasedBeforeStart(commands);
    expect(standalone.getState().running).toBe(true);
  });

  it('keeps the song playing with its click off', async () => {
    const { commands, song, standalone } = await songWithClick();
    standalone.getState().start();
    expect(commands.mixerPause).not.toHaveBeenCalled();
    expect(commands.mixerStop).not.toHaveBeenCalled();
    expect(song.getState()).toMatchObject({ status: 'ready', click: false });
  });

  it('starts the standalone on the settings it had before the song', async () => {
    const { commands, standalone } = await songWithClick();
    const before = configOf(standalone.getState());
    let readByStart: ReturnType<typeof configOf> | null = null;
    commands.metronomeStart.mockImplementation(() => {
      readByStart = configOf(standalone.getState());
    });
    standalone.getState().start();
    expect(readByStart).toEqual(before);
    expect(configOf(standalone.getState())).toEqual(before);
    expect(commands.setTempo).not.toHaveBeenCalled();
    expect(commands.setBeats).not.toHaveBeenCalled();
    expect(commands.setSounds).not.toHaveBeenCalled();
    expect(commands.setAccent).not.toHaveBeenCalled();
  });

  it('leaves the standalone running when the song closes later', async () => {
    const { commands, song, standalone } = await songWithClick();
    standalone.getState().start();
    vi.clearAllMocks();
    song.getState().close();
    expect(commands.metronomeStop).not.toHaveBeenCalled();
    expect(standalone.getState().running).toBe(true);
  });

  it('names the song that keeps playing', async () => {
    const { standalone, songClick } = await songWithClick();
    standalone.getState().start();
    expect(songClick.notice.getState().released).toMatchObject({
      title: SONG_TITLE,
    });
    songClick.notice.getState().dismiss();
    expect(songClick.notice.getState().released).toBeNull();
  });

  it('cancels a song click still turning on', async () => {
    const { fake, song, standalone, songClick } = await openedSongClick();
    const { commands } = fake;
    const gridSet = holdSetGrid(commands);
    const turningOn = song.getState().toggleClick();
    vi.clearAllMocks();
    standalone.getState().start();
    gridSet();
    await turningOn;
    expect(commands.metronomeFollowMixer).not.toHaveBeenCalledWith(true);
    expect(commands.clearGrid).toHaveBeenCalledOnce();
    expect(commands.metronomeStart).toHaveBeenCalledOnce();
    expect(song.getState().click).toBe(false);
    expect(songClick.notice.getState().released).toMatchObject({
      title: SONG_TITLE,
    });
  });

  it('releases a stem song click the same way', async () => {
    const { commands, stems, standalone } = await stemsWithClick();
    standalone.getState().start();
    expectReleasedBeforeStart(commands);
    expect(commands.mixerPause).not.toHaveBeenCalled();
    expect(commands.mixerStop).not.toHaveBeenCalled();
    expect(stems.getState().click).toBe(false);
  });
});

describe('standalone Play with no song click', () => {
  it('touches no grid while the song plays without its click', async () => {
    const { fake, standalone, songClick } = await openedSongClick();
    vi.clearAllMocks();
    standalone.getState().start();
    expect(fake.commands.clearGrid).not.toHaveBeenCalled();
    expect(fake.commands.metronomeFollowMixer).not.toHaveBeenCalled();
    expect(songClick.notice.getState().released).toBeNull();
  });
});

describe('a session that ends or is displaced', () => {
  it('sends no grid commands once the song closed first', async () => {
    const { fake, song, standalone, songClick } = await openedSongClick();
    await song.getState().toggleClick();
    song.getState().close();
    vi.clearAllMocks();
    standalone.getState().start();
    expect(fake.commands.clearGrid).not.toHaveBeenCalled();
    expect(fake.commands.metronomeFollowMixer).not.toHaveBeenCalled();
    expect(songClick.notice.getState().released).toBeNull();
  });

  it('drops a turn-on still pending when the song closes and reopens', async () => {
    const { fake, song, standalone, songClick } = await openedSongClick();
    const gridSet = holdSetGrid(fake.commands);
    const turningOn = song.getState().toggleClick();
    song.getState().close();
    await song.getState().open(SONG_ID, BARS).loaded;
    vi.clearAllMocks();
    standalone.getState().start();
    expect(fake.commands.metronomeFollowMixer).not.toHaveBeenCalled();
    expect(songClick.notice.getState().released).toBeNull();
    gridSet();
    await turningOn;
    expect(song.getState().click).toBe(false);
  });

  it('releases the stem click after a stem song displaced the song', async () => {
    const songClick = createMixerClick();
    const claim = createMixerClaim();
    const { song } = await openedSongClick(songClick, claim);
    await song.getState().toggleClick();
    const { fake, stems } = stemStore(songClick, claim);
    await stems.getState().open(STEM_SET_ID, STEM_BARS);
    await stems.getState().toggleClick();
    song.getState().close();
    const standalone = standaloneOver(fake.commands, songClick);
    vi.clearAllMocks();
    standalone.getState().start();
    expectReleasedBeforeStart(fake.commands);
    expect(stems.getState().click).toBe(false);
    expect(songClick.notice.getState().released).toMatchObject({
      title: stems.getState().title,
    });
  });
});
