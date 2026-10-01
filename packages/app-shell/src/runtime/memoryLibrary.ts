import type {
  NewSongPreset,
  Setlist,
  SetlistItem,
  SongPreset,
} from '@kitbag/core-db';
import type { LibraryRepositories } from '@kitbag/core-state';

const BLOB_FIELDS = ['accents', 'perAccentSounds', 'polyAccents'] as const;

interface Tables {
  setlists: Setlist[];
  items: SetlistItem[];
  presets: SongPreset[];
  nextId: number;
}

export interface TextStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

const PRESET_DEFAULTS = {
  denominator: 4,
  perAccentSounds: null,
  polyAccents: null,
  rampEnabled: false,
  rampStartBpm: null,
  rampEndBpm: null,
  rampBars: null,
  barMuteEnabled: false,
  barMutePlayBars: null,
  barMuteMuteBars: null,
  countInBars: 0,
  notes: null,
  phaseNudge: 0,
  title: null,
  artist: null,
  source: null,
  lengthSeconds: null,
  librarySongId: null,
};

function contains(text: string | null, query: string): boolean {
  return text?.toLowerCase().includes(query.toLowerCase()) ?? false;
}

function blobsToArrays(preset: SongPreset): unknown {
  const out: Record<string, unknown> = { ...preset };
  for (const field of BLOB_FIELDS) {
    const value = preset[field];
    out[field] = value === null ? null : Array.from(value);
  }
  return out;
}

function arraysToBlobs(raw: Record<string, unknown>): SongPreset {
  const out: Record<string, unknown> = { ...raw };
  for (const field of BLOB_FIELDS) {
    const value = raw[field];
    out[field] = Array.isArray(value)
      ? Uint8Array.from(value as number[])
      : null;
  }
  return out as unknown as SongPreset;
}

function load(storage: TextStorage | undefined, key: string): Tables {
  const saved = storage?.getItem(key);
  if (saved === null || saved === undefined) {
    return { setlists: [], items: [], presets: [], nextId: 1 };
  }
  const parsed = JSON.parse(saved) as Tables;
  const presets = (parsed.presets as unknown as Record<string, unknown>[]).map(
    arraysToBlobs,
  );
  return { ...parsed, presets };
}

export function createMemoryStore(
  storage?: TextStorage,
  key = 'kitbag.library',
) {
  const tables = load(storage, key);
  const save = () => {
    const snapshot = { ...tables, presets: tables.presets.map(blobsToArrays) };
    storage?.setItem(key, JSON.stringify(snapshot));
  };
  const nextId = () => tables.nextId++;
  return { tables, save, nextId };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;

function ordered(store: MemoryStore, setlistId: number): SetlistItem[] {
  return store.tables.items
    .filter((item) => item.setlistId === setlistId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

function place(
  store: MemoryStore,
  item: SetlistItem,
  setlistId: number,
  position: number | undefined,
): void {
  const others = ordered(store, setlistId).filter((e) => e.id !== item.id);
  const target = Math.max(
    0,
    Math.min(position ?? others.length, others.length),
  );
  others.splice(target, 0, item);
  others.forEach((entry, index) => {
    entry.setlistId = setlistId;
    entry.position = index;
  });
}

function renumber(store: MemoryStore, setlistId: number): void {
  ordered(store, setlistId).forEach((entry, index) => {
    entry.position = index;
  });
}

function findItem(store: MemoryStore, itemId: number): SetlistItem {
  const item = store.tables.items.find((entry) => entry.id === itemId);
  if (item === undefined)
    throw new Error(`Setlist item ${String(itemId)} not found`);
  return item;
}

function moveItem(
  store: MemoryStore,
  itemId: number,
  setlistId: number | undefined,
  position: number | undefined,
): void {
  const item = findItem(store, itemId);
  const source = item.setlistId;
  place(store, item, setlistId ?? source, position);
  if (source !== item.setlistId) renumber(store, source);
}

function addItem(
  store: MemoryStore,
  setlistId: number,
  presetId: number,
  position: number | undefined,
): SetlistItem {
  const item = {
    id: store.nextId(),
    setlistId,
    songPresetId: presetId,
    position: 0,
  };
  store.tables.items.push(item);
  place(store, item, setlistId, position);
  return { ...item };
}

function newSetlist(store: MemoryStore, name: string): Setlist {
  const setlist = {
    id: store.nextId(),
    name,
    uuid: crypto.randomUUID(),
    active: false,
  };
  store.tables.setlists.push(setlist);
  return { ...setlist };
}

function duplicateSetlist(store: MemoryStore, setlistId: number, name: string) {
  const copy = newSetlist(store, name);
  ordered(store, setlistId).forEach((item, position) => {
    store.tables.items.push({
      id: store.nextId(),
      setlistId: copy.id,
      songPresetId: item.songPresetId,
      position,
    });
  });
  return copy;
}

function deleteSetlist(store: MemoryStore, setlistId: number): void {
  const { tables } = store;
  tables.setlists = tables.setlists.filter((s) => s.id !== setlistId);
  tables.items = tables.items.filter((item) => item.setlistId !== setlistId);
}

function selectActive(store: MemoryStore, setlistId: number | null): void {
  for (const setlist of store.tables.setlists) {
    setlist.active = setlist.id === setlistId;
  }
}

function mutating<A extends unknown[], R>(
  store: MemoryStore,
  run: (...args: A) => R,
) {
  return (...args: A): Promise<R> => {
    const result = run(...args);
    store.save();
    return Promise.resolve(result);
  };
}

function setlistReads(store: MemoryStore) {
  const { tables } = store;
  return {
    list: () => Promise.resolve(tables.setlists.map((s) => ({ ...s }))),
    active: () => Promise.resolve(tables.setlists.find((s) => s.active)),
    search: (query: string) =>
      Promise.resolve(tables.setlists.filter((s) => contains(s.name, query))),
    items: (setlistId: number) =>
      Promise.resolve(ordered(store, setlistId).map((item) => ({ ...item }))),
  };
}

function itemWrites(store: MemoryStore) {
  return {
    add: mutating(
      store,
      (setlistId: number, presetId: number, position?: number) =>
        addItem(store, setlistId, presetId, position),
    ),
    moveTo: mutating(
      store,
      (itemId: number, setlistId: number, position?: number) => {
        moveItem(store, itemId, setlistId, position);
      },
    ),
    move: mutating(store, (itemId: number, position: number) => {
      moveItem(store, itemId, undefined, position);
    }),
    removeItem: mutating(store, (itemId: number) => {
      store.tables.items = store.tables.items.filter(
        (item) => item.id !== itemId,
      );
    }),
  };
}

export function createMemorySetlists(
  store: MemoryStore,
): LibraryRepositories['setlists'] {
  return {
    ...setlistReads(store),
    create: mutating(store, (name: string) => newSetlist(store, name)),
    rename: mutating(store, (id: number, name: string) => {
      const setlist = store.tables.setlists.find((s) => s.id === id);
      if (setlist !== undefined) setlist.name = name;
    }),
    delete: mutating(store, (id: number) => {
      deleteSetlist(store, id);
    }),
    duplicate: mutating(store, (id: number, name: string) =>
      duplicateSetlist(store, id, name),
    ),
    selectActive: mutating(store, (id: number | null) => {
      selectActive(store, id);
    }),
    ...itemWrites(store),
  };
}

function insertPreset(store: MemoryStore, values: NewSongPreset): SongPreset {
  const preset = {
    ...PRESET_DEFAULTS,
    ...values,
    id: store.nextId(),
    uuid: crypto.randomUUID(),
  } as SongPreset;
  store.tables.presets.push(preset);
  return { ...preset };
}

function presetSearch(store: MemoryStore, query: string): SongPreset[] {
  return store.tables.presets.filter(
    (p) =>
      contains(p.name, query) ||
      contains(p.title, query) ||
      contains(p.artist, query),
  );
}

function findPreset(store: MemoryStore, id: number): SongPreset {
  const preset = store.tables.presets.find((p) => p.id === id);
  if (preset === undefined)
    throw new Error(`Song preset ${String(id)} not found`);
  return preset;
}

function deletePreset(store: MemoryStore, id: number): void {
  const { tables } = store;
  tables.presets = tables.presets.filter((p) => p.id !== id);
  tables.items = tables.items.filter((item) => item.songPresetId !== id);
}

export function createMemoryPresets(
  store: MemoryStore,
): LibraryRepositories['presets'] {
  return {
    get: (id: number) =>
      Promise.resolve(store.tables.presets.find((p) => p.id === id)),
    list: () => Promise.resolve(store.tables.presets.map((p) => ({ ...p }))),
    search: (query: string) => Promise.resolve(presetSearch(store, query)),
    create: mutating(store, (values: NewSongPreset) =>
      insertPreset(store, values),
    ),
    update: mutating(
      store,
      (id: number, values: Partial<Omit<NewSongPreset, 'id'>>) => {
        Object.assign(findPreset(store, id), values);
      },
    ),
    duplicate: mutating(store, (id: number, name: string) => {
      const copy: Partial<SongPreset> = { ...findPreset(store, id), name };
      delete copy.id;
      return insertPreset(store, copy as NewSongPreset);
    }),
    delete: mutating(store, (id: number) => {
      deletePreset(store, id);
    }),
  };
}

export function createMemoryLibrary(
  storage?: TextStorage,
): LibraryRepositories {
  const store = createMemoryStore(storage);
  return {
    setlists: createMemorySetlists(store),
    presets: createMemoryPresets(store),
  };
}
