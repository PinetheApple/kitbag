import {
  configureStandaloneMetronomePersistence,
  getBackup,
  libraryStore,
  metronomeStore,
  songLibraryStore,
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

await import('./backupRuntime.ts');

const SONG_BPM = 90;
const EDITED_BPM = 95;
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

function memoryPersistence(): StandaloneMetronomePersistence {
  let stored: Partial<MetronomeSettingsInput> = {};
  return {
    load: () => stored,
    save: (settings) => {
      stored = settings;
    },
  };
}

it('restores through the app database', () => {
  expect(getBackup().service()).toBe(service);
});

it('reloads setlists, library songs and tunings after a restore', async () => {
  const { refresh, refreshSongs, loadCustomTunings } = stubRefreshes();

  await getBackup().afterRestore();

  expect(refresh).toHaveBeenCalledOnce();
  expect(refreshSongs).toHaveBeenCalledOnce();
  expect(loadCustomTunings).toHaveBeenCalledOnce();
});

it('keeps edits made after a restore across a relaunch', async () => {
  const persistence = memoryPersistence();
  configureStandaloneMetronomePersistence(persistence);
  stubRefreshes();
  libraryStore.setState({
    loaded: LOADED_SONG,
    discarded: DISCARDED,
    played: [LOADED_SONG.itemId],
  });
  metronomeStore.getState().setTempo(SONG_BPM);

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
