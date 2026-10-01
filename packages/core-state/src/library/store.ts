import type { NewSongPreset, Setlist, SongPreset } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import { applyPreset, presetFromMetronome } from './presetMapping.ts';
import { getLibrary, type LibraryRepositories } from './runtime.ts';
import { takeSnapshot, type LibrarySnapshot } from './snapshot.ts';

export interface LoadedSong {
  readonly presetId: number;
  readonly itemId: number | null;
}

export interface SearchResults {
  readonly query: string;
  readonly setlists: readonly Setlist[];
  readonly presets: readonly SongPreset[];
}

export interface LibraryState extends LibrarySnapshot {
  readonly ready: boolean;
  readonly loaded: LoadedSong | null;
  readonly played: readonly number[];
  readonly results: SearchResults | null;
}

export type PresetEdit = Partial<Omit<NewSongPreset, 'id'>>;

export interface LibraryActions {
  refresh: () => Promise<void>;
  search: (query: string) => Promise<void>;
  createSetlist: (name: string) => Promise<number>;
  renameSetlist: (setlistId: number, name: string) => Promise<void>;
  duplicateSetlist: (setlistId: number) => Promise<number>;
  deleteSetlist: (setlistId: number) => Promise<void>;
  newSongFromCurrent: (name: string, setlistId?: number) => Promise<number>;
  addToSetlist: (setlistId: number, presetId: number) => Promise<void>;
  reorder: (setlistId: number, from: number, to: number) => Promise<void>;
  moveToSetlist: (itemId: number, setlistId: number) => Promise<void>;
  removeFromSet: (itemId: number) => Promise<void>;
  duplicatePreset: (presetId: number, setlistId?: number) => Promise<number>;
  deletePreset: (presetId: number) => Promise<void>;
  savePreset: (presetId: number, edit: PresetEdit) => Promise<void>;
  saveCurrentInto: (presetId: number) => Promise<void>;
  loadSong: (
    presetId: number,
    itemId?: number,
    setlistId?: number,
  ) => Promise<void>;
}

export type LibraryStore = LibraryState & LibraryActions;

type SetState = StoreApi<LibraryStore>['setState'];
type Get = StoreApi<LibraryStore>['getState'];

export interface LibraryDeps {
  readonly repos: () => LibraryRepositories;
  readonly metronome: () => MetronomeStore;
}

const defaultDeps: LibraryDeps = {
  repos: getLibrary,
  metronome: () => metronomeStore.getState(),
};

const EMPTY: LibraryState = {
  ready: false,
  setlists: [],
  entries: {},
  presets: [],
  standalone: [],
  loaded: null,
  played: [],
  results: null,
};

function copyName(name: string): string {
  return `${name} copy`;
}

function setlistActions(deps: LibraryDeps, get: Get) {
  const sets = () => deps.repos().setlists;
  return {
    createSetlist: async (name: string) => {
      const created = await sets().create(name);
      await get().refresh();
      return created.id;
    },
    renameSetlist: async (setlistId: number, name: string) => {
      await sets().rename(setlistId, name);
      await get().refresh();
    },
    duplicateSetlist: async (setlistId: number) => {
      const source = get().setlists.find((s) => s.setlist.id === setlistId);
      const name = copyName(source?.setlist.name ?? '');
      const copy = await sets().duplicate(setlistId, name);
      await get().refresh();
      return copy.id;
    },
    deleteSetlist: async (setlistId: number) => {
      await sets().delete(setlistId);
      await get().refresh();
    },
  };
}

function itemActions(deps: LibraryDeps, get: Get) {
  const sets = () => deps.repos().setlists;
  const entryAt = (setlistId: number, index: number) =>
    get().entries[setlistId]?.[index];
  return {
    addToSetlist: async (setlistId: number, presetId: number) => {
      await sets().add(setlistId, presetId);
      await get().refresh();
    },
    reorder: async (setlistId: number, from: number, to: number) => {
      const entry = entryAt(setlistId, from);
      if (entry === undefined) return;
      await sets().move(entry.item.id, to);
      await get().refresh();
    },
    moveToSetlist: async (itemId: number, setlistId: number) => {
      await sets().moveTo(itemId, setlistId);
      await get().refresh();
    },
    removeFromSet: async (itemId: number) => {
      await sets().removeItem(itemId);
      await get().refresh();
    },
  };
}

function presetActions(deps: LibraryDeps, get: Get) {
  const presets = () => deps.repos().presets;
  return {
    newSongFromCurrent: async (name: string, setlistId?: number) => {
      const fields = presetFromMetronome(deps.metronome());
      const created = await presets().create({ ...fields, name });
      if (setlistId !== undefined)
        await deps.repos().setlists.add(setlistId, created.id);
      await get().refresh();
      return created.id;
    },
    duplicatePreset: async (presetId: number, setlistId?: number) => {
      const source = get().presets.find((p) => p.id === presetId);
      const copy = await presets().duplicate(
        presetId,
        copyName(source?.name ?? ''),
      );
      if (setlistId !== undefined)
        await deps.repos().setlists.add(setlistId, copy.id);
      await get().refresh();
      return copy.id;
    },
  };
}

function presetEditActions(deps: LibraryDeps, get: Get) {
  const presets = () => deps.repos().presets;
  return {
    deletePreset: async (presetId: number) => {
      await presets().delete(presetId);
      await get().refresh();
    },
    savePreset: async (presetId: number, edit: PresetEdit) => {
      await presets().update(presetId, edit);
      await get().refresh();
    },
    saveCurrentInto: async (presetId: number) => {
      await presets().update(presetId, presetFromMetronome(deps.metronome()));
      await get().refresh();
    },
  };
}

function loadActions(deps: LibraryDeps, set: SetState, get: Get) {
  return {
    loadSong: async (presetId: number, itemId?: number, setlistId?: number) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (preset === undefined) return;
      applyPreset(preset, deps.metronome);
      const loaded = { presetId, itemId: itemId ?? null };
      if (setlistId === undefined || itemId === undefined) {
        set({ loaded });
        return;
      }
      const earlier = (await activate(deps, get, setlistId))
        ? []
        : get().played;
      const played = earlier.includes(itemId) ? earlier : [...earlier, itemId];
      set({ loaded, played });
      await get().refresh();
    },
  };
}

async function activate(
  deps: LibraryDeps,
  get: Get,
  setlistId: number,
): Promise<boolean> {
  const current = get().setlists.find((s) => s.setlist.active);
  if (current?.setlist.id === setlistId) return false;
  await deps.repos().setlists.selectActive(setlistId);
  return true;
}

function readActions(deps: LibraryDeps, set: SetState, get: Get) {
  return {
    refresh: async () => {
      set({ ...(await takeSnapshot(deps.repos())), ready: true });
      const query = get().results?.query;
      if (query !== undefined) await get().search(query);
    },
    search: async (query: string) => {
      if (query.trim() === '') {
        set({ results: null });
        return;
      }
      const repos = deps.repos();
      const [setlists, presets] = await Promise.all([
        repos.setlists.search(query),
        repos.presets.search(query),
      ]);
      set({ results: { query, setlists, presets } });
    },
  };
}

export function createLibraryStore(
  deps: LibraryDeps = defaultDeps,
): StoreApi<LibraryStore> {
  return createStore<LibraryStore>((set, get) => ({
    ...EMPTY,
    ...readActions(deps, set, get),
    ...setlistActions(deps, get),
    ...itemActions(deps, get),
    ...presetActions(deps, get),
    ...presetEditActions(deps, get),
    ...loadActions(deps, set, get),
  }));
}

export const libraryStore = createLibraryStore();
