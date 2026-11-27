import type { ClickSoundRepository } from '@kitbag/core-db';
import {
  configureClickSounds,
  configureStandaloneMetronomePersistence,
  createMetronomeStore,
  flushStandaloneMetronomePersistence,
  configureAppearancePersistence,
  configureHomeLayoutPersistence,
  getAppearanceStore,
  getBackup,
  getHomeLayoutStore,
  libraryStore,
  metronomeStore,
  songLibraryStore,
  standaloneMetronomeOf,
  tunerStore,
  type DiscardedChanges,
  type MetronomeSettingsInput,
  type StandaloneMetronomePersistence,
} from '@kitbag/core-state';
import { customSoundId, KB_DEFAULT_SOUNDS } from '@kitbag/core-native';
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

const rig = vi.hoisted(() => {
  const flush = vi.fn(() => Promise.resolve());
  return {
    flush,
    reloadRigSettings: vi.fn(() => Promise.resolve()),
    routeLatency: { getState: () => ({ flush }) },
  };
});

vi.mock('@/settings/rigRuntime', () => rig);
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
  pickDocument: vi.fn(),
  sniffUnsupportedFormat: vi.fn(),
  constants: vi.fn(),
  listFiles: vi.fn(),
  clearPartials: vi.fn(),
});

await import('./backupRuntime.ts');

const NO_SOUND_CHANGES = {
  counts: {},
  soundResets: 0,
  staleSlots: { restored: [], local: [] },
};
const STALE_SLOT = 0;
const SLOT_SOUND = customSoundId(STALE_SLOT);
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

let storedTheme: 'light' | 'dark' = 'light';
configureAppearancePersistence({
  load: () => ({ theme: storedTheme }),
  save: () => undefined,
});
const RESTORED_LAYOUT = [{ toolId: 'tuner', size: '2x1', hidden: false }];
let storedLayout: typeof RESTORED_LAYOUT | undefined;
configureHomeLayoutPersistence({
  load: () => storedLayout,
  save: () => undefined,
});

it('applies restored theme, Home layout and rig settings without a restart', async () => {
  stubRefreshes();
  expect(getAppearanceStore().getState().theme).toBe('light');
  expect(getHomeLayoutStore().getState().arrangement).toBeUndefined();
  storedTheme = 'dark';
  storedLayout = RESTORED_LAYOUT;
  rig.reloadRigSettings.mockClear();

  await getBackup().afterRestore(NO_SOUND_CHANGES);

  expect(getAppearanceStore().getState().theme).toBe('dark');
  expect(getHomeLayoutStore().getState().arrangement).toEqual(RESTORED_LAYOUT);
  expect(rig.reloadRigSettings).toHaveBeenCalledOnce();
});

it('stores a pending route latency change before a restore applies', async () => {
  rig.flush.mockClear();

  await getBackup().beforeRestore();

  expect(rig.flush).toHaveBeenCalledOnce();
});

it('restores through the app database', () => {
  expect(getBackup().service()).toBe(service);
});

it('reloads setlists, library songs, tunings and click sounds after a restore', async () => {
  const { refresh, refreshSongs, loadCustomTunings } = stubRefreshes();
  clickSounds.list.mockClear();

  await getBackup().afterRestore(NO_SOUND_CHANGES);

  expect(refresh).toHaveBeenCalledOnce();
  expect(refreshSongs).toHaveBeenCalledOnce();
  expect(loadCustomTunings).toHaveBeenCalledOnce();
  expect(clickSounds.list).toHaveBeenCalledOnce();
});

it('plays and keeps the restored standalone settings over the unloaded song', async () => {
  stubRefreshes();
  loadSong();
  stored = { bpm: RESTORED_BPM };

  await getBackup().afterRestore(NO_SOUND_CHANGES);
  await Promise.resolve();

  expect(metronomeStore.getState().bpm).toBe(RESTORED_BPM);
  expect(stored.bpm).toBe(RESTORED_BPM);
});

it('puts Tick in the restored standalone sounds whose slot changed', async () => {
  stubRefreshes();
  stored = {
    bpm: RESTORED_BPM,
    sounds: { normal: SLOT_SOUND, accent: SLOT_SOUND },
  };

  await getBackup().afterRestore({
    ...NO_SOUND_CHANGES,
    staleSlots: { restored: [], local: [STALE_SLOT] },
  });
  await Promise.resolve();

  expect(stored.sounds).toEqual(KB_DEFAULT_SOUNDS);
  expect(metronomeStore.getState().sounds).toEqual(KB_DEFAULT_SOUNDS);
});

const defaults = () => standaloneMetronomeOf(createMetronomeStore().getState());

it('resets to the defaults when a replace empties the stored settings', async () => {
  stubRefreshes();
  metronomeStore.getState().setTempo(SONG_BPM);
  await Promise.resolve();
  stored = {};

  await getBackup().afterRestore(NO_SOUND_CHANGES);
  await Promise.resolve();

  expect(standaloneMetronomeOf(metronomeStore.getState())).toEqual(defaults());
  expect(stored).toEqual(defaults());
});

it('resets to the defaults, not the unloaded song, when a replace empties them', async () => {
  stubRefreshes();
  loadSong();
  stored = {};

  await getBackup().afterRestore(NO_SOUND_CHANGES);
  await Promise.resolve();

  expect(standaloneMetronomeOf(metronomeStore.getState())).toEqual(defaults());
  expect(stored).toEqual(defaults());
});

it('keeps edits made after a restore across a relaunch', async () => {
  stubRefreshes();
  loadSong();

  await getBackup().afterRestore(NO_SOUND_CHANGES);
  const { loaded, discarded, played } = libraryStore.getState();
  expect({ loaded, discarded, played }).toEqual({
    loaded: null,
    discarded: null,
    played: [],
  });
  metronomeStore.getState().setTempo(EDITED_BPM);
  await Promise.resolve();
  flushStandaloneMetronomePersistence();

  vi.resetModules();
  const relaunched = await import('@kitbag/core-state');
  relaunched.configureStandaloneMetronomePersistence(persistence);
  expect(relaunched.metronomeStore.getState().bpm).toBe(EDITED_BPM);
});
