import type { NewSongPreset, Setlist, SongPreset } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';
import {
  applyPreset,
  isLoadedSongUnsaved,
  presetFromMetronome,
  songFieldsFromMetronome,
  type LiveSongFields,
} from './presetMapping.ts';
import { getLibrary, type LibraryRepositories } from './runtime.ts';
import {
  activeSetlistOf,
  adjacentEntry,
  followedIndex,
  indexIn,
  stagePositionOf,
  type SongStep,
} from './setlistPosition.ts';
import { metronomeSongsOf } from './metronomeSongs.ts';
import {
  isPresetEntry,
  takeSnapshot,
  type LibrarySnapshot,
  type SetlistEntry,
} from './snapshot.ts';

export interface LoadedPreset {
  readonly presetId: number;
  readonly itemId: number | null;
  readonly setlistId: number | null;
  readonly index?: number;
}

export interface LoadedStem {
  readonly presetId: null;
  readonly stemSetId: number;
  readonly itemId: number;
  readonly setlistId: number;
  readonly index: number;
}

export type LoadedSong = LoadedPreset | LoadedStem;

export interface SongStepResult {
  readonly entry: SetlistEntry | undefined;
  readonly skipped: boolean;
}

export interface DiscardedChanges {
  readonly loaded: LoadedPreset;
  readonly settings: LiveSongFields;
  readonly at: number;
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
  readonly discarded: DiscardedChanges | null;
  readonly played: readonly number[];
  readonly results: SearchResults | null;
  readonly carriedSkip: boolean;
  readonly songLoads: number;
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
  addStemToSetlist: (setlistId: number, stemSetId: number) => Promise<void>;
  reorder: (setlistId: number, from: number, to: number) => Promise<void>;
  moveToSetlist: (itemId: number, setlistId: number) => Promise<void>;
  removeFromSet: (itemId: number) => Promise<void>;
  duplicatePreset: (presetId: number, setlistId?: number) => Promise<number>;
  deletePreset: (presetId: number) => Promise<void>;
  savePreset: (presetId: number, edit: PresetEdit) => Promise<void>;
  saveCurrentInto: (presetId: number) => Promise<void>;
  saveLoadedSong: () => Promise<void>;
  revertLoadedSong: () => void;
  undoDiscard: () => Promise<void>;
  dismissDiscarded: () => void;
  loadSong: (
    presetId: number,
    itemId?: number,
    setlistId?: number,
  ) => Promise<void>;
  openStemEntry: (itemId: number, setlistId: number) => Promise<boolean>;
  stepSong: (step: SongStep) => Promise<SongStepResult>;
  carrySkip: (carried: boolean) => void;
  leaveSetlist: () => Promise<void>;
  clearSong: () => void;
}

export type LibraryStore = LibraryState & LibraryActions;

type SetState = StoreApi<LibraryStore>['setState'];
type Get = StoreApi<LibraryStore>['getState'];

export interface LibraryDeps {
  readonly repos: () => LibraryRepositories;
  readonly metronome: () => MetronomeStore;
  readonly now: () => number;
}

const defaultDeps: LibraryDeps = {
  repos: getLibrary,
  metronome: () => metronomeStore.getState(),
  now: Date.now,
};

const EMPTY: LibraryState = {
  ready: false,
  failed: false,
  setlists: [],
  entries: {},
  presets: [],
  metronomeSongs: [],
  standalone: [],
  loaded: null,
  discarded: null,
  played: [],
  results: null,
  carriedSkip: false,
  songLoads: 0,
};

export function loadedPresetOf(
  state: Pick<LibraryState, 'presets' | 'loaded'>,
): SongPreset | undefined {
  const { loaded } = state;
  if (loaded === null) return undefined;
  return state.presets.find((preset) => preset.id === loaded.presetId);
}

function discardedNow(
  state: LibraryState,
  deps: LibraryDeps,
): DiscardedChanges | null {
  const preset = loadedPresetOf(state);
  const { loaded } = state;
  if (loaded?.presetId == null || preset === undefined) return null;
  const live = deps.metronome();
  if (!isLoadedSongUnsaved(preset, live)) return null;
  return {
    loaded: { ...loaded, presetId: loaded.presetId },
    settings: presetFromMetronome(live),
    at: deps.now(),
  };
}

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
    addStemToSetlist: async (setlistId: number, stemSetId: number) => {
      await sets().addStemSet(setlistId, stemSetId);
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

function presetEditActions(deps: LibraryDeps, set: SetState, get: Get) {
  const presets = () => deps.repos().presets;
  return {
    deletePreset: async (presetId: number) => {
      await presets().delete(presetId);
      if (get().loaded?.presetId === presetId) set({ loaded: null });
      await get().refresh();
    },
    savePreset: async (presetId: number, edit: PresetEdit) => {
      await presets().update(presetId, edit);
      await get().refresh();
    },
    saveCurrentInto: async (presetId: number) => {
      await presets().update(
        presetId,
        songFieldsFromMetronome(deps.metronome()),
      );
      await get().refresh();
    },
  };
}

const NO_STEP: SongStepResult = { entry: undefined, skipped: false };

interface StepTarget {
  readonly entry: SetlistEntry;
  readonly setlistId: number;
}

function stepTarget(
  state: LibraryState,
  step: SongStep,
): StepTarget | undefined {
  const active = activeSetlistOf(state.setlists);
  if (active === undefined) return undefined;
  const setlistId = active.setlist.id;
  const entries = state.entries[setlistId] ?? [];
  const position = stagePositionOf(state.loaded, setlistId);
  const entry = adjacentEntry(entries, position, step);
  return entry === undefined ? undefined : { entry, setlistId };
}

function wasDeleted(state: LibraryState, target: StepTarget): boolean {
  return indexIn(state.entries[target.setlistId], target.entry.item.id) < 0;
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
  const pinQuietly = async (setlistId: number, itemId: number) => {
    try {
      await pin(setlistId, itemId);
    } catch {
      // The song is already open; a failed pin only loses the on-stage marker.
    }
  };
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
  const link = async (
    preset: SongPreset,
    itemId: number | null,
    setlistId: number | null,
  ) => {
    applyPreset(preset, deps.metronome);
    if (setlistId === null || itemId === null) {
      set({
        loaded: { presetId: preset.id, itemId: null, setlistId: null },
        songLoads: get().songLoads + 1,
      });
      // The stage bar keys off loaded.setlistId, so it hides even if this fails.
      await leaveOrWarn();
      return;
    }
    const index = indexIn(get().entries[setlistId], itemId);
    const at = index < 0 ? {} : { index };
    set({
      loaded: { presetId: preset.id, itemId, setlistId, ...at },
      songLoads: get().songLoads + 1,
    });
    await pinQuietly(setlistId, itemId);
  };
  const noteDiscard = () => {
    const discarded = discardedNow(get(), deps);
    if (discarded !== null) set({ discarded });
  };
  return {
    loadSong: async (presetId: number, itemId?: number, setlistId?: number) => {
      const preset = get().presets.find((p) => p.id === presetId);
      if (preset === undefined) return;
      noteDiscard();
      await link(preset, itemId ?? null, setlistId ?? null);
    },
    openStemEntry: async (itemId: number, setlistId: number) => {
      const entries = get().entries[setlistId];
      const index = indexIn(entries, itemId);
      const entry = entries?.[index];
      if (entry === undefined || isPresetEntry(entry)) return false;
      noteDiscard();
      const { stemSetId } = entry;
      set({ loaded: { presetId: null, stemSetId, itemId, setlistId, index } });
      await pinQuietly(setlistId, itemId);
      return true;
    },
    stepSong: async (step: SongStep): Promise<SongStepResult> => {
      const first = stepTarget(get(), step);
      if (first === undefined) return NO_STEP;
      if (!isPresetEntry(first.entry)) await get().refresh();
      const skipped = wasDeleted(get(), first);
      const next = stepTarget(get(), step);
      if (next === undefined) return { entry: undefined, skipped };
      const { entry, setlistId } = next;
      if (isPresetEntry(entry)) {
        await get().loadSong(entry.preset.id, entry.item.id, setlistId);
        return { entry, skipped };
      }
      const opened = await get().openStemEntry(entry.item.id, setlistId);
      return { entry: opened ? entry : undefined, skipped };
    },
    carrySkip: (carried: boolean) => {
      set({ carriedSkip: carried });
    },
    leaveSetlist: async () => {
      noteDiscard();
      set({ loaded: null });
      await leaveOrWarn();
    },
    clearSong: () => {
      noteDiscard();
      set({ loaded: null });
    },
    saveLoadedSong: async () => {
      const presetId = get().loaded?.presetId;
      if (presetId == null) return;
      await get().saveCurrentInto(presetId);
    },
    revertLoadedSong: () => {
      const preset = loadedPresetOf(get());
      if (preset !== undefined) applyPreset(preset, deps.metronome);
    },
    undoDiscard: async () => {
      const { discarded } = get();
      if (discarded === null) return;
      const { loaded, settings } = discarded;
      const preset = loadedPresetOf({ presets: get().presets, loaded });
      set({ discarded: null });
      noteDiscard();
      if (preset === undefined) return;
      await link({ ...preset, ...settings }, loaded.itemId, loaded.setlistId);
    },
    dismissDiscarded: () => {
      set({ discarded: null });
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
      const loaded = followedIndex(
        get().loaded,
        get().entries,
        snapshot.entries,
      );
      set({ ...snapshot, loaded, ready: true, failed: false });
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
      set({ results: { query, setlists, presets: metronomeSongsOf(presets) } });
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
    ...presetEditActions(deps, set, get),
    ...loadActions(deps, set, get),
  }));
}

export const libraryStore = createLibraryStore();
