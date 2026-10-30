import type { NewSongPreset, Setlist, SongPreset } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import { applyPreset, presetFromMetronome } from './presetMapping.ts';
import { getLibrary, type LibraryRepositories } from './runtime.ts';
import {
  activeSetlistOf,
  adjacentEntry,
  type SongStep,
} from './setlistPosition.ts';
import { takeSnapshot, type LibrarySnapshot } from './snapshot.ts';

export interface LoadedSong {
  readonly presetId: number;
  readonly itemId: number | null;
  readonly setlistId: number | null;
}

export interface SearchResults {
  readonly query: string;
  readonly setlists: readonly Setlist[];
  readonly presets: readonly SongPreset[];
}

export interface LibraryState extends LibrarySnapshot {
  readonly ready: boolean;
  readonly failed: boolean;
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
  stepSong: (step: SongStep) => Promise<void>;
  leaveSetlist: () => Promise<void>;
  clearSong: () => void;
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
  failed: false,
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

function serialised() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  };
}

function loadActions(deps: LibraryDeps, set: SetState, get: Get) {
  const inOrder = serialised();
  const pin = (setlistId: number, itemId: number) =>
    inOrder(async () => {
      const earlier = (await switchActiveSetlist(deps, get, setlistId))
        ? []
        : get().played;
      const played = earlier.includes(itemId) ? earlier : [...earlier, itemId];
      set({ played });
      await get().refresh();
    });
  const leave = () =>
    inOrder(async () => {
      if (activeSetlistOf(get().setlists) === undefined) return;
      await deps.repos().setlists.selectActive(null);
      set({ played: [] });
      await get().refresh();
    });
  const leaveOrWarn = async () => {
    try {
      await leave();
    } catch (error) {
      console.warn('[kitbag] leaving the setlist failed', error);
    }
  };
  return {
    loadSong: async (presetId: number, itemId?: number, setlistId?: number) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (preset === undefined) return;
      applyPreset(preset, deps.metronome);
      if (setlistId === undefined || itemId === undefined) {
        set({ loaded: { presetId, itemId: null, setlistId: null } });
        // The stage bar keys off loaded.setlistId, so it hides even if this fails.
        await leaveOrWarn();
        return;
      }
      set({ loaded: { presetId, itemId, setlistId } });
      try {
        await pin(setlistId, itemId);
      } catch {
        // The song is already playing; a failed pin only loses the on-stage marker.
      }
    },
    stepSong: async (step: SongStep) => {
      const active = activeSetlistOf(get().setlists);
      if (active === undefined) return;
      const setlistId = active.setlist.id;
      const entry = adjacentEntry(
        get().entries[setlistId] ?? [],
        get().loaded?.itemId ?? null,
        step,
      );
      if (entry === undefined) return;
      await get().loadSong(entry.preset.id, entry.item.id, setlistId);
    },
    leaveSetlist: async () => {
      set({ loaded: null });
      await leaveOrWarn();
    },
    clearSong: () => {
      set({ loaded: null });
    },
  };
}

async function switchActiveSetlist(
  deps: LibraryDeps,
  get: Get,
  setlistId: number,
): Promise<boolean> {
  const current = activeSetlistOf(get().setlists);
  if (current?.setlist.id === setlistId) return false;
  await deps.repos().setlists.selectActive(setlistId);
  return true;
}

function readActions(deps: LibraryDeps, set: SetState, get: Get) {
  return {
    refresh: async () => {
      let snapshot: LibrarySnapshot;
      try {
        snapshot = await takeSnapshot(deps.repos());
      } catch (error) {
        console.warn('[kitbag] library load failed', error);
        set({ ready: true, failed: true });
        return;
      }
      set({ ...snapshot, ready: true, failed: false });
      const query = get().results?.query;
      if (query === undefined) return;
      try {
        await get().search(query);
      } catch (error) {
        console.warn('[kitbag] library search failed', error);
      }
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
