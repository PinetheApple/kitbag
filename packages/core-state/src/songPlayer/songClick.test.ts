import {
  KB_ACCENT,
  KB_COUNT_IN_BARS,
  KB_SOUND_NAMES,
} from '@kitbag/core-native';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

import {
  BARS,
  fakeMetronome,
  fakeSongRuntime,
  SONG_ID,
  songStore,
} from './store.test-helper.ts';

const STANDALONE_SOUNDS = { normal: 1, accent: 2 } as const;
const SONG_SOUNDS = {
  normal: KB_SOUND_NAMES.length - 1,
  accent: KB_SOUND_NAMES.length - 2,
} as const;
const STANDALONE_ACCENTS = [
  KB_ACCENT.KB_ACCENT_ACCENTED,
  KB_ACCENT.KB_ACCENT_MUTED,
  KB_ACCENT.KB_ACCENT_NORMAL,
  KB_ACCENT.KB_ACCENT_NORMAL,
];
const FIRST_BEAT = 0;
const LONGEST_COUNT_IN = Math.max(...KB_COUNT_IN_BARS);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function songBesideStandalone() {
  const fake = fakeSongRuntime();
  const metronome = fakeMetronome();
  fake.metronome = metronome;
  const standalone = metronome.store.getState();
  standalone.setSounds(STANDALONE_SOUNDS.normal, STANDALONE_SOUNDS.accent);
  standalone.setAccents(STANDALONE_ACCENTS);
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS).loaded;
  vi.clearAllMocks();
  return { fake, metronome, store };
}

function lastAccentPerBeat(
  setAccent: Mock<(beat: number, accent: number) => void>,
) {
  const last = new Map<number, number>();
  for (const [beat, accent] of setAccent.mock.calls) last.set(beat, accent);
  return [...last.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, accent]) => accent);
}

describe("a song's click settings", () => {
  it('open seeded from the standalone metronome and clean', async () => {
    const { metronome, store } = await songBesideStandalone();
    expect(store.getState().clickSettings).toEqual({
      countInBars: metronome.store.getState().countIn.bars,
      sounds: STANDALONE_SOUNDS,
      accents: STANDALONE_ACCENTS,
      dirty: false,
    });
  });

  it('are dirty after an edit, and clean after the next open', async () => {
    const { store } = await songBesideStandalone();
    store.getState().setClickCountIn(LONGEST_COUNT_IN);
    expect(store.getState().clickSettings.dirty).toBe(true);
    store.getState().close();
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().clickSettings.dirty).toBe(false);
  });

  it("put the song's pattern on the engine before the click starts", async () => {
    const { fake, metronome, store } = await songBesideStandalone();
    store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    expect(metronome.commands.setSounds).not.toHaveBeenCalled();
    await store.getState().toggleClick();
    expect(metronome.commands.setSounds).toHaveBeenCalledWith(
      SONG_SOUNDS.normal,
      SONG_SOUNDS.accent,
    );
    expect(lastAccentPerBeat(metronome.commands.setAccent)).toEqual(
      STANDALONE_ACCENTS,
    );
    const [pushed] = metronome.commands.setSounds.mock.invocationCallOrder;
    const [started] = fake.commands.metronomeStart.mock.invocationCallOrder;
    expect(pushed).toBeLessThan(started ?? 0);
  });

  it('reach the engine live while the click runs', async () => {
    const { metronome, store } = await songBesideStandalone();
    await store.getState().toggleClick();
    vi.clearAllMocks();
    store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    store.getState().cycleClickAccent(FIRST_BEAT);
    expect(metronome.commands.setSounds).toHaveBeenCalledWith(
      SONG_SOUNDS.normal,
      SONG_SOUNDS.accent,
    );
    expect(metronome.commands.setAccent).toHaveBeenCalledWith(
      FIRST_BEAT,
      KB_ACCENT.KB_ACCENT_NORMAL,
    );
  });

  async function editedClickRunning() {
    const fixture = await songBesideStandalone();
    const { store } = fixture;
    store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    store.getState().cycleClickAccent(FIRST_BEAT);
    await store.getState().toggleClick();
    vi.clearAllMocks();
    return fixture;
  }

  function expectStandaloneOnEngine(metronome: Metronome) {
    expect(metronome.commands.setSounds).toHaveBeenLastCalledWith(
      STANDALONE_SOUNDS.normal,
      STANDALONE_SOUNDS.accent,
    );
    expect(lastAccentPerBeat(metronome.commands.setAccent)).toEqual(
      STANDALONE_ACCENTS,
    );
  }

  it("leave the standalone's exact values on the engine after click off", async () => {
    const { metronome, store } = await editedClickRunning();
    await store.getState().toggleClick();
    expectStandaloneOnEngine(metronome);
  });

  it("leave the standalone's exact values on the engine after close", async () => {
    const { metronome, store } = await editedClickRunning();
    store.getState().close();
    expectStandaloneOnEngine(metronome);
  });

  it('never change the standalone metronome, mid-run or after', async () => {
    const { metronome, store } = await songBesideStandalone();
    const before = metronome.store.getState();
    store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    store.getState().cycleClickAccent(FIRST_BEAT);
    store.getState().setClickCountIn(LONGEST_COUNT_IN);
    await store.getState().toggleClick();
    store.getState().cycleClickAccent(FIRST_BEAT);
    expect(metronome.store.getState()).toEqual(before);
    await store.getState().toggleClick();
    expect(metronome.store.getState()).toEqual(before);
    await store.getState().toggleClick();
    store.getState().close();
    expect(metronome.store.getState()).toEqual(before);
  });
});

type Metronome = ReturnType<typeof fakeMetronome>;
