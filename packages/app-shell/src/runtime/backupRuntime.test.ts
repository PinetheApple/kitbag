import type { ClickSoundRepository } from '@kitbag/core-db';
import {
  configureClickSounds,
  configureStandaloneMetronomePersistence,
  createMetronomeStore,
  getBackup,
  libraryStore,
  metronomeStore,
  songLibraryStore,
  standaloneMetronomeOf,
  tunerStore,
  type DiscardedChanges,
  type MetronomeSettingsInput,
  type StandaloneMetronomePersistence,
} from '@kitbag/core-state';
import { expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ plan: vi.fn() }));
const engine = vi.hoisted(() => ({
  setTempo: vi.fn(),
  setBeats: vi.fn(),
  setSubdivision: vi.fn(),
  setSubdivisionAccents: vi.fn(),
  setAccent: vi.fn(),
  setPoly: vi.fn(),
  setPolyAccent: vi.fn(),
  setPolyAgainst: vi.fn(),
  setSounds: vi.fn(),
  setRamp: vi.fn(),
  setBarMute: vi.fn(),
}));

vi.mock('./database.ts', () => ({
  getDatabase: () => ({ backup: service }),
}));
vi.mock('@kitbag/core-native', async (actual) => ({
  ...(await actual<typeof import('@kitbag/core-native')>()),
  getKitbagCommands: () => engine,
}));

const clickSounds = { list: vi.fn(() => Promise.resolve([])) };
configureClickSounds({
  repository: () => clickSounds as unknown as ClickSoundRepository,
  prepare: vi.fn(),
  load: vi.fn(),
  clear: vi.fn(),
  deleteFile: vi.fn(),
  newUuid: vi.fn(),
  freshFileName: vi.fn(),
  afterRemove: vi.fn(),
});

await import('./backupRuntime.ts');

const SONG_BPM = 90;
const EDITED_BPM = 95;
const RESTORED_BPM = 140;
const LOADED_SONG = { presetId: 7, itemId: 4, setlistId: 2 };
const DISCARDED: DiscardedChanges = {
  loaded: LOADED_SONG,
  settings: {} as DiscardedChanges['settings'],
  at: 0,
};

function stubRefreshes() {
  const refresh = vi.fn(() => Promise.resolve());
  const refreshSongs = vi.fn(() => Promise.resolve());
  const loadCustomTunings = vi.fn(() => Promise.resolve());
  libraryStore.setState({ refresh });
  songLibraryStore.setState({ refresh: refreshSongs });
  tunerStore.setState({ loadCustomTunings });
  return { refresh, refreshSongs, loadCustomTunings };
}

let stored: Partial<MetronomeSettingsInput> = {};
const persistence: StandaloneMetronomePersistence = {
  load: () => stored,
  save: (settings) => {
    stored = settings;
  },
};
configureStandaloneMetronomePersistence(persistence);

function loadSong() {
  libraryStore.setState({
    loaded: LOADED_SONG,
    discarded: DISCARDED,
    played: [LOADED_SONG.itemId],
  });
  metronomeStore.getState().setTempo(SONG_BPM);
}

it('restores through the app database', () => {
  expect(getBackup().service()).toBe(service);
});

it('reloads setlists, library songs, tunings and click sounds after a restore', async () => {
  const { refresh, refreshSongs, loadCustomTunings } = stubRefreshes();
  clickSounds.list.mockClear();

  await getBackup().afterRestore();

  expect(refresh).toHaveBeenCalledOnce();
  expect(refreshSongs).toHaveBeenCalledOnce();
  expect(loadCustomTunings).toHaveBeenCalledOnce();
  expect(clickSounds.list).toHaveBeenCalledOnce();
});

it('plays and keeps the restored standalone settings over the unloaded song', async () => {
  stubRefreshes();
  loadSong();
  stored = { bpm: RESTORED_BPM };

  await getBackup().afterRestore();
  await Promise.resolve();

  expect(metronomeStore.getState().bpm).toBe(RESTORED_BPM);
  expect(stored.bpm).toBe(RESTORED_BPM);
});

const defaults = () => standaloneMetronomeOf(createMetronomeStore().getState());

it('resets to the defaults when a replace empties the stored settings', async () => {
  stubRefreshes();
  metronomeStore.getState().setTempo(SONG_BPM);
  await Promise.resolve();
  stored = {};

  await getBackup().afterRestore();
  await Promise.resolve();

  expect(standaloneMetronomeOf(metronomeStore.getState())).toEqual(defaults());
  expect(stored).toEqual(defaults());
});

it('resets to the defaults, not the unloaded song, when a replace empties them', async () => {
  stubRefreshes();
  loadSong();
  stored = {};

  await getBackup().afterRestore();
  await Promise.resolve();

  expect(standaloneMetronomeOf(metronomeStore.getState())).toEqual(defaults());
  expect(stored).toEqual(defaults());
});

it('keeps edits made after a restore across a relaunch', async () => {
  stubRefreshes();
  loadSong();

  await getBackup().afterRestore();
  const { loaded, discarded, played } = libraryStore.getState();
  expect({ loaded, discarded, played }).toEqual({
    loaded: null,
    discarded: null,
    played: [],
  });
  metronomeStore.getState().setTempo(EDITED_BPM);
  await Promise.resolve();

  vi.resetModules();
  const relaunched = await import('@kitbag/core-state');
  relaunched.configureStandaloneMetronomePersistence(persistence);
  expect(relaunched.metronomeStore.getState().bpm).toBe(EDITED_BPM);
});
