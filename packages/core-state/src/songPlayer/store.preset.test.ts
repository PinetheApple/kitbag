import { KB_ACCENT, KB_SOUND_NAMES } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';

const STANDALONE_SOUNDS = { normal: 1, accent: 2 } as const;
const SONG_SOUNDS = {
  normal: KB_SOUND_NAMES.length - 1,
  accent: KB_SOUND_NAMES.length - 2,
} as const;
const STANDALONE_BPM = 90;
const SONG_BPM = 120;
const SAVED_COUNT_IN = 2;
const FIRST_BEAT = 0;
const OTHER_SONG = SONG_ID + 1;
const { KB_ACCENT_ACCENTED: ACC, KB_ACCENT_NORMAL: NOR } = KB_ACCENT;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function openedBesideStandalone() {
  const fake = fakeSongRuntime(songRecord({ bpm: SONG_BPM }));
  const standalone = fake.standalone.store.getState();
  standalone.setSounds(STANDALONE_SOUNDS.normal, STANDALONE_SOUNDS.accent);
  standalone.setTempo(STANDALONE_BPM);
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS).loaded;
  return { fake, store };
}

async function editedAndSaved() {
  const opened = await openedBesideStandalone();
  const song = opened.store.getState();
  song.setClickSounds(SONG_SOUNDS.normal, SONG_SOUNDS.accent);
  song.cycleClickAccent(FIRST_BEAT);
  song.setClickCountIn(SAVED_COUNT_IN);
  await opened.store.getState().saveForSong();
  return opened;
}

async function reopened(
  store: Awaited<ReturnType<typeof editedAndSaved>>['store'],
) {
  store.getState().close();
  await store.getState().open(SONG_ID, BARS).loaded;
}

describe('a song without a saved preset', () => {
  it('opens with its click off, seeded from the standalone metronome', async () => {
    const { fake, store } = await openedBesideStandalone();
    expect(fake.records.forLibrarySong).toHaveBeenCalledWith(SONG_ID);
    expect(store.getState().click).toBe(false);
    expect(store.getState().clickSettings.sounds).toEqual(STANDALONE_SOUNDS);
    expect(store.getState().clickSettings.dirty).toBe(false);
  });
});

describe('Save for this song', () => {
  it("writes the song's click as a preset linked to the song", async () => {
    const { fake } = await editedAndSaved();
    expect(fake.records.saveForLibrarySong).toHaveBeenCalledOnce();
    const [songId, values] =
      fake.records.saveForLibrarySong.mock.calls[0] ?? [];
    expect(songId).toBe(SONG_ID);
    expect(values).toMatchObject({
      name: 'Everlong',
      bpm: SONG_BPM,
      beatsPerBar: 4,
      sound: SONG_SOUNDS.normal,
      countInBars: SAVED_COUNT_IN,
      polyEnabled: false,
      rampEnabled: false,
      barMuteEnabled: false,
    });
    expect(Array.from(values?.accents ?? [])).toEqual([NOR, NOR, NOR, NOR]);
    expect(Array.from(values?.perAccentSounds ?? [])).toEqual([
      SONG_SOUNDS.normal,
      SONG_SOUNDS.accent,
    ]);
  });

  it('clears the unsaved mark', async () => {
    const { store } = await editedAndSaved();
    expect(store.getState().clickSettings.dirty).toBe(false);
  });

  it('keeps the mark when an edit lands while saving', async () => {
    const { store } = await openedBesideStandalone();
    store.getState().setClickCountIn(SAVED_COUNT_IN);
    const saving = store.getState().saveForSong();
    store.getState().cycleClickAccent(FIRST_BEAT);
    await saving;
    expect(store.getState().clickSettings.dirty).toBe(true);
  });

  it('keeps the mark when the save fails', async () => {
    const { fake, store } = await openedBesideStandalone();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    fake.records.saveForLibrarySong.mockRejectedValueOnce(new Error('disk'));
    store.getState().setClickCountIn(SAVED_COUNT_IN);
    await store.getState().saveForSong();
    expect(store.getState().clickSettings.dirty).toBe(true);
  });

  it('leaves the standalone metronome as it was', async () => {
    const { fake } = await editedAndSaved();
    const standalone = fake.standalone.store.getState();
    expect(standalone.sounds).toEqual(STANDALONE_SOUNDS);
    expect(standalone.bpm).toBe(STANDALONE_BPM);
  });
});

describe('a song with a saved preset', () => {
  it('reopens with the saved click, turned on', async () => {
    const { fake, store } = await editedAndSaved();
    await reopened(store);
    expect(store.getState().clickSettings).toEqual({
      countInBars: SAVED_COUNT_IN,
      sounds: SONG_SOUNDS,
      accents: [NOR, NOR, NOR, NOR],
      dirty: false,
    });
    expect(store.getState().click).toBe(true);
    expect(fake.commands.metronomeStart).toHaveBeenCalled();
  });

  it("keeps the song's tempo from its grid, not the preset", async () => {
    const { fake, store } = await editedAndSaved();
    fake.records.readSong.mockResolvedValue(songRecord({ bpm: SONG_BPM + 1 }));
    await reopened(store);
    expect(store.getState().bpm).toBe(SONG_BPM + 1);
  });

  it('does not lend its click to another song', async () => {
    const { store } = await editedAndSaved();
    store.getState().close();
    await store.getState().open(OTHER_SONG, BARS).loaded;
    expect(store.getState().click).toBe(false);
    expect(store.getState().clickSettings.sounds).toEqual(STANDALONE_SOUNDS);
    expect(store.getState().clickSettings.accents[FIRST_BEAT]).toBe(ACC);
  });
});
