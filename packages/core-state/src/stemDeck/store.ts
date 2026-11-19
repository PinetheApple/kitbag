import type { ExistingStemSet } from '@kitbag/core-db';
import type { StemDeckConstants } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { getSongLibrary } from '../songLibrary/runtime.ts';
import {
  songLibraryStore,
  type SongLibraryActions,
} from '../songLibrary/store.ts';
import type { CatalogSong } from './catalog.ts';
import {
  connectionActions,
  type ConnectionActions,
  type ConnectionState,
} from './connection.ts';
import {
  importActions,
  type ImportActions,
  type ImportState,
} from './importActions.ts';
import {
  getStemDeck,
  type StemDeckCamera,
  type StemDeckNative,
  type UnityNoticePersistence,
} from './runtime.ts';
import { scanActions, type ScanActions, type ScanState } from './scan.ts';

export type {
  Connection,
  RecentServer,
  ServerTrust,
  TrustPrompt,
} from './connection.ts';

export interface StemDeckState extends ConnectionState, ImportState, ScanState {
  readonly codes: StemDeckConstants | null;
  readonly setlistId: string | null;
  readonly query: string;
  readonly selected: readonly string[];
}

export interface StemDeckActions
  extends ConnectionActions, ImportActions, ScanActions {
  setSetlist: (setlistId: string | null) => void;
  setQuery: (query: string) => void;
  toggleSong: (jobId: string) => void;
  selectSongs: (jobIds: readonly string[]) => void;
}

export type StemDeckStore = StemDeckState & StemDeckActions;

export interface StemDeckDeps {
  readonly native: () => StemDeckNative;
  readonly unityNotice: () => UnityNoticePersistence;
  readonly addFetchedBundle: SongLibraryActions['addFetchedBundle'];
  readonly inLibrary: (jobId: string) => Promise<boolean>;
  readonly findSameSong: (
    song: CatalogSong,
  ) => Promise<ExistingStemSet | undefined>;
  readonly camera: () => StemDeckCamera;
}

const defaultDeps: StemDeckDeps = {
  native: () => getStemDeck().native,
  unityNotice: () => getStemDeck().unityNotice,
  addFetchedBundle: (source, options) =>
    songLibraryStore.getState().addFetchedBundle(source, options),
  inLibrary: async (jobId) =>
    (await getSongLibrary().records.findStemSetByJobId(jobId)) !== undefined,
  findSameSong: async ({ title, artist, durationSec }) => {
    if (durationSec === null) return undefined;
    const [newest] = await getSongLibrary().records.findStemSetMatches({
      title,
      artist,
      durationSec,
    });
    return newest;
  },
  camera: () => getStemDeck().camera,
};

export type SetState = StoreApi<StemDeckStore>['setState'];
export type Get = StoreApi<StemDeckStore>['getState'];

const INITIAL: StemDeckState = {
  codes: null,
  connection: { status: 'idle' },
  recents: [],
  catalog: null,
  loadingCatalog: false,
  setlistId: null,
  query: '',
  selected: [],
  importView: null,
  importFailure: null,
  replacePrompt: null,
  unityNoticeSeen: false,
  address: '',
  addressFocus: 0,
  camera: null,
  cameraUnavailable: false,
};

function listActions(set: SetState, get: Get) {
  return {
    setSetlist: (setlistId: string | null) => {
      set({ setlistId });
    },
    setQuery: (query: string) => {
      set({ query });
    },
    toggleSong: (jobId: string) => {
      const { selected } = get();
      set({
        selected: selected.includes(jobId)
          ? selected.filter((id) => id !== jobId)
          : [...selected, jobId],
      });
    },
    selectSongs: (jobIds: readonly string[]) => {
      set({ selected: [...jobIds] });
    },
  };
}

export function createStemDeckStore(
  deps: StemDeckDeps = defaultDeps,
): StoreApi<StemDeckStore> {
  return createStore<StemDeckStore>((set, get) => ({
    ...INITIAL,
    ...connectionActions(deps, set, get),
    ...listActions(set, get),
    ...importActions(deps, set, get),
    ...scanActions(deps, set, get),
  }));
}

export const stemDeckStore = createStemDeckStore();
