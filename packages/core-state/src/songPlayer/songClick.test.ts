import { GRID_METER, type SongRecord } from '@kitbag/core-db';
import {
  KB_ACCENT,
  KB_COUNT_IN_BARS,
  KB_SOUND_NAMES,
} from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createMixerClaim } from '../stemPlayer/mixerClaim.ts';
import { createStemPlayerStore } from '../stemPlayer/store.ts';
import {
  fakeRuntime as fakeStemRuntime,
  record,
  SONG_DETAILS,
  stem,
} from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  lastAccentPerBeat,
  leftPlaying,
  SONG_ID,
  songRecord,
  songStore,
  type Fake,
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
const OTHER_SONG = SONG_ID + 1;
const STEM_SET_ID = 7;
const LONGEST_COUNT_IN = Math.max(...KB_COUNT_IN_BARS);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function songBesideStandalone(
  song: SongRecord = songRecord(),
  claim = createMixerClaim(),
) {
  const fake = fakeSongRuntime(song);
  const metronome = fake.standalone;
  const standalone = metronome.store.getState();
  standalone.setSounds(STANDALONE_SOUNDS.normal, STANDALONE_SOUNDS.accent);
  standalone.setAccents(STANDALONE_ACCENTS);
  const store = songStore(fake, claim);
  await store.getState().open(SONG_ID, BARS).loaded;
  vi.clearAllMocks();
  return { fake, metronome, store, claim };
}

async function editedClickRunning(claim = createMixerClaim()) {
  const fixture = await songBesideStandalone(songRecord(), claim);
  const { store } = fixture;
  store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
  store.getState().cycleClickAccent(FIRST_BEAT);
  await store.getState().toggleClick();
  vi.clearAllMocks();
  return fixture;
}

function expectStandaloneOnEngine({ standalone }: Pick<Fake, 'standalone'>) {
  const { sounds, accents } = standalone.store.getState();
  expect(standalone.commands.setSounds).toHaveBeenLastCalledWith(
    sounds.normal,
    sounds.accent,
  );
  expect(lastAccentPerBeat(standalone.commands.setAccent)).toEqual(accents);
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

  it('stay clean when an edit changes nothing', async () => {
    const { metronome, store } = await songBesideStandalone();
    const { countIn } = metronome.store.getState();
    store
      .getState()
      .setClickSounds(STANDALONE_SOUNDS.normal, STANDALONE_SOUNDS.accent);
    store.getState().setClickCountIn(countIn.bars);
    expect(store.getState().clickSettings.dirty).toBe(false);
  });

  it('survive a re-open of the song still playing', async () => {
    const { store } = await songBesideStandalone();
    store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    const edited = store.getState().clickSettings;
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(store.getState().clickSettings).toBe(edited);
    expect(edited.dirty).toBe(true);
  });

  it('fit the accents to a 3/4 song beside a 4/4 standalone', async () => {
    const { metronome, store } = await songBesideStandalone(
      songRecord({ meterBeatsPerBar: GRID_METER.triple }),
    );
    const triple = STANDALONE_ACCENTS.slice(0, GRID_METER.triple);
    expect(store.getState().clickSettings.accents).toEqual(triple);
    await store.getState().toggleClick();
    expect(lastAccentPerBeat(metronome.commands.setAccent)).toEqual(triple);
  });

  it("are at the song's meter in the same update that makes it ready", async () => {
    const fake = fakeSongRuntime(
      songRecord({ meterBeatsPerBar: GRID_METER.triple }),
    );
    const store = songStore(fake);
    const atReady: number[] = [];
    store.subscribe((state, previous) => {
      if (state.status === 'ready' && previous.status !== 'ready')
        atReady.push(state.clickSettings.accents.length);
    });
    await store.getState().open(SONG_ID, BARS).loaded;
    expect(atReady).toEqual([GRID_METER.triple]);
  });

  it("refit the accents live when the song's meter changes", async () => {
    const { metronome, store } = await songBesideStandalone();
    await store.getState().toggleClick();
    vi.clearAllMocks();
    store.getState().meterOverrideChanged(SONG_ID, {
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: null,
    });
    const triple = STANDALONE_ACCENTS.slice(0, GRID_METER.triple);
    expect(store.getState().clickSettings.accents).toEqual(triple);
    expect(lastAccentPerBeat(metronome.commands.setAccent)).toEqual(triple);
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

  it('never change the standalone metronome, mid-run or after', async () => {
    const { metronome, store } = await songBesideStandalone();
    const before = metronome.store.getState();
    const notified = vi.fn();
    metronome.store.subscribe(notified);
    store.getState().setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    store.getState().cycleClickAccent(FIRST_BEAT);
    store.getState().setClickCountIn(LONGEST_COUNT_IN);
    await store.getState().toggleClick();
    store.getState().cycleClickAccent(FIRST_BEAT);
    await store.getState().toggleClick();
    await store.getState().toggleClick();
    store.getState().close();
    expect(notified).not.toHaveBeenCalled();
    expect(metronome.store.getState()).toBe(before);
  });
});

describe("the standalone's values back on the engine", () => {
  it('after click off', async () => {
    const { fake, store } = await editedClickRunning();
    await store.getState().toggleClick();
    expectStandaloneOnEngine(fake);
  });

  it('after close', async () => {
    const { fake, store } = await editedClickRunning();
    store.getState().close();
    expectStandaloneOnEngine(fake);
  });

  it('after another song opens over the click', async () => {
    const { fake, store } = await editedClickRunning();
    await store.getState().open(OTHER_SONG, BARS).loaded;
    expectStandaloneOnEngine(fake);
  });

  it("after Stop on the song's notification", async () => {
    const left = await leftPlaying();
    left.player
      .getState()
      .setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
    await left.player.getState().toggleClick();
    vi.clearAllMocks();
    left.stopSongFromNotification();
    expectStandaloneOnEngine(left);
  });

  it('after a stem song claims the mixer, whose own click sends none', async () => {
    const claim = createMixerClaim();
    const { fake } = await editedClickRunning(claim);
    const stemFake = fakeStemRuntime(record([stem(1)], SONG_DETAILS));
    const stems = createStemPlayerStore(() => stemFake.runtime, {
      mixerClaim: claim,
    });
    await stems.getState().open(STEM_SET_ID, BARS);
    expectStandaloneOnEngine(fake);
    vi.clearAllMocks();
    await stems.getState().toggleClick();
    expect(stems.getState().click).toBe(true);
    expect(fake.standalone.commands.setSounds).not.toHaveBeenCalled();
    expect(fake.standalone.commands.setAccent).not.toHaveBeenCalled();
  });
});
