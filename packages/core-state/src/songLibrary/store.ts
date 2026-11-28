import type {
  LibraryRow,
  MeterOverridePatch,
  TempoCorrection,
} from '@kitbag/core-db';
import type {
  AnalysisResult,
  LibraryConstants,
  PickedDocument,
} from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { fileRemovals } from './logic.ts';
import { finishHeldSongDeletions } from './heldSongFiles.ts';
import { cleanName } from '../names.ts';
import { resultRecord } from './analysisRecord.ts';
import { documentImports, isBatch } from './importBatch.ts';
import {
  availabilityRefresher,
  type RowFilesByKey,
  type RowPathsByKey,
} from './availability.ts';
import {
  outdatedGridQueue,
  requeueAndRefresh,
  type OutdatedGridQueue,
} from './outdatedGrids.ts';
import {
  getSongLibrary,
  type LibraryFiles,
  type OpenSong,
  type SongLibraryRecords,
  type TempoFitter,
} from './runtime.ts';
import { rowDeletion, type DeletedLibrarySong } from './songDeletion.ts';
import { songGridSaves } from './songGridSaves.ts';
import { stemBundleActions, type BundleSource } from './stemBundleImport.ts';
import { fitUntimedStemSets } from './stemTempoFit.ts';
import {
  type BundleAddOutcome,
  type BundleRefusal,
  type ReplaceChoice,
} from './stemBundleLogic.ts';
import { fileWorkTracker, type FileWorkTracker } from './fileWork.ts';
import { sweepOrphanedStemFolders } from './stemFolderSweep.ts';
import {
  deleteLeftovers,
  enqueue,
  loadCodes,
  warn,
  type Get,
  type SetState,
} from './storeSupport.ts';

export type LibraryNotice =
  | {
      readonly kind: 'bundleRefused';
      readonly name: string;
      readonly refusal: BundleRefusal;
    }
  | {
      readonly kind: 'formatRefused';
      readonly name: string;
      readonly format: string;
      readonly supported: readonly string[];
    }
  | { readonly kind: 'copyFailed'; readonly name: string }
  | { readonly kind: 'addFailed'; readonly name: string }
  | { readonly kind: 'importsFailed'; readonly names: readonly string[] }
  | { readonly kind: 'pickerFailed' }
  | { readonly kind: 'deleteFailed'; readonly name: string }
  | { readonly kind: 'renameFailed'; readonly name: string }
  | { readonly kind: 'stemSongAdded'; readonly name: string };

export interface SongLibraryState {
  readonly ready: boolean;
  readonly failed: boolean;
  readonly rows: readonly LibraryRow[];
  readonly query: string;
  readonly importing: readonly string[];
  readonly notice: LibraryNotice | null;
  readonly replacePrompt: ReplacePrompt | null;
  readonly codes: LibraryConstants | null;
  readonly rowFiles: RowFilesByKey;
  readonly rowPaths: RowPathsByKey;
  readonly deletedSong: DeletedLibrarySong | null;
}

export type ReplaceMatch = 'job' | 'song';

export interface ReplacePrompt {
  readonly name: string;
  readonly title: string;
  readonly match: ReplaceMatch;
}

export interface SongLibraryActions {
  refresh: () => Promise<void>;
  start: () => Promise<() => void>;
  analyzeUnfinished: () => Promise<void>;
  receiveAnalysis: (result: AnalysisResult) => Promise<void>;
  setQuery: (query: string) => void;
  importSong: () => Promise<void>;
  importDocuments: (docs: readonly PickedDocument[]) => Promise<void>;
  importStemFolder: () => Promise<void>;
  reanalyze: (songId: number) => Promise<void>;
  deleteRow: (row: LibraryRow) => Promise<void>;
  deleteRowWithUndo: (row: LibraryRow) => Promise<void>;
  undoDeleteSong: () => Promise<void>;
  dismissDeletedSong: () => Promise<void>;
  renameRow: (row: LibraryRow, name: string) => Promise<void>;
  correctDuration: (songId: number, durationSec: number) => Promise<void>;
  saveSongMeterOverride: (
    songId: number,
    patch: MeterOverridePatch,
  ) => Promise<boolean>;
  saveSongTempoCorrection: (
    songId: number,
    correction: TempoCorrection,
  ) => Promise<boolean>;
  dismissNotice: () => void;
  confirmReplace: () => Promise<void>;
  keepBoth: () => Promise<void>;
  cancelReplace: () => void;
  addFetchedBundle: (
    source: BundleSource,
    choice: ReplaceChoice,
  ) => Promise<BundleAddOutcome>;
}

export type SongLibraryStore = SongLibraryState & SongLibraryActions;

export interface SongLibraryDeps {
  readonly records: () => SongLibraryRecords;
  readonly files: () => LibraryFiles;
  readonly newUuid: () => string;
  readonly openSong: () => OpenSong;
  readonly fitTempo: () => TempoFitter;
  readonly now: () => number;
}

const defaultDeps: SongLibraryDeps = {
  records: () => getSongLibrary().records,
  files: () => getSongLibrary().files,
  newUuid: () => crypto.randomUUID(),
  openSong: () => getSongLibrary().openSong,
  fitTempo: () => getSongLibrary().fitTempo,
  now: Date.now,
};

const INITIAL: SongLibraryState = {
  ready: false,
  failed: false,
  rows: [],
  query: '',
  importing: [],
  notice: null,
  replacePrompt: null,
  codes: null,
  rowFiles: new Map(),
  rowPaths: new Map(),
  deletedSong: null,
};

function readActions(deps: SongLibraryDeps, set: SetState, get: Get) {
  return {
    refresh: async () => {
      const codes = loadCodes(deps, get);
      try {
        const rows = await deps.records().list();
        set({ rows, codes, ready: true, failed: false });
      } catch (error) {
        warn('song library load failed', error);
        set({ ready: true, failed: true });
      }
    },
    setQuery: (query: string) => {
      set({ query });
    },
    dismissNotice: () => {
      set({ notice: null });
    },
  };
}

function importActions(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
  fileWork: FileWorkTracker,
) {
  const bundles = stemBundleActions(deps, set, get, fileWork);
  const importEach = documentImports(deps, set, get, bundles.importBundle);
  let busy: Promise<void> | null = null;
  const hold = () => {
    let finish: (() => void) | null = null;
    busy = new Promise<void>((resolve) => (finish = resolve));
    return () => {
      busy = null;
      finish?.();
    };
  };
  const openPicker = async <T>(open: () => Promise<T | null>) => {
    try {
      return await open();
    } catch (error) {
      warn('picker failed', error);
      set({ notice: { kind: 'pickerFailed' } });
      return null;
    }
  };
  const pickThen = async <T>(
    open: () => Promise<T | null>,
    importPicked: (picked: T) => Promise<unknown>,
    holdsPicker: (picked: T) => boolean = () => false,
  ) => {
    if (busy !== null) return;
    const release = hold();
    set({ notice: null });
    const picked = await openPicker(open);
    const holds = picked !== null && holdsPicker(picked);
    if (!holds) release();
    if (picked === null) return;
    try {
      await importPicked(picked);
    } finally {
      if (holds) release();
    }
  };
  const importDocuments = async (docs: readonly PickedDocument[]) => {
    while (busy !== null) await busy;
    const release = isBatch(docs) ? hold() : null;
    try {
      await importEach(docs);
    } finally {
      release?.();
    }
  };
  return {
    importSong: () =>
      pickThen(() => deps.files().pickDocuments(), importEach, isBatch),
    importDocuments,
    importStemFolder: () =>
      pickThen(
        () => deps.files().pickFolder(),
        (folder) => bundles.importBundle({ ...folder, isFolder: true }),
      ),
    confirmReplace: bundles.confirmReplace,
    keepBoth: bundles.keepBoth,
    cancelReplace: bundles.cancelReplace,
    addFetchedBundle: bundles.addFetchedBundle,
  };
}

function analysisActions(
  deps: SongLibraryDeps,
  get: Get,
  fileWork: FileWorkTracker,
  queue: OutdatedGridQueue,
  refreshAvailability: () => Promise<void>,
) {
  // A result can arrive both as an event and from pendingAnalyses, so applying
  // it must be idempotent; it is acknowledged only once it is stored.
  const storeResult = async (result: AnalysisResult) => {
    const files = deps.files();
    try {
      const outcome = await deps.records().applyAnalysis(resultRecord(result));
      files.acknowledgeAnalysis(result.relativePath);
      await deleteLeftovers(
        files,
        fileRemovals([outcome.unusedWaveform]),
        result.relativePath,
      );
    } catch (error) {
      warn(`analysis result for ${result.relativePath} not stored`, error);
    }
    await get().refresh();
    await queue.settled(result.relativePath);
  };
  const receiveAnalysis = async (result: AnalysisResult) => {
    await storeResult(result);
    if (!result.ok) await refreshAvailability();
  };
  const analyzeUnfinished = async () => {
    const files = deps.files();
    for (const song of await deps.records().claimUnfinishedAnalyses())
      enqueue(files, song, false);
    await get().refresh();
  };
  const startAnalysis = async () => {
    const files = deps.files();
    const stopResults = files.onAnalysis((result) => {
      void receiveAnalysis(result);
    });
    const stopWatchingPlayer = deps.openSong().onChange(() => {
      void queue.resume();
    });
    const stopWatchingFolder = files.onDataFolderChanged(() => {
      void refreshAvailability();
    });
    for (const result of await files.pendingAnalyses())
      await storeResult(result);
    await analyzeUnfinished();
    await refreshAvailability();
    await queue.resume();
    await sweepOrphanedStemFolders(deps, get, fileWork);
    await finishHeldSongDeletions(deps, get, fileWork);
    await fitUntimedStemSets(deps);
    return () => {
      stopResults();
      stopWatchingPlayer();
      stopWatchingFolder();
    };
  };
  return {
    receiveAnalysis,
    analyzeUnfinished,
    start: async () => {
      try {
        return await startAnalysis();
      } catch (error) {
        await get().refresh();
        throw error;
      }
    },
    reanalyze: async (songId: number) => {
      await requeueAndRefresh(deps, get, songId);
    },
  };
}

function rowActions(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
  queue: OutdatedGridQueue,
  fileWork: FileWorkTracker,
) {
  return {
    ...rowDeletion(deps, set, get, queue, fileWork),
    renameRow: async (row: LibraryRow, name: string) => {
      const title = cleanName(name);
      if (title === null || title === row.title) return;
      const records = deps.records();
      try {
        if (row.kind === 'stems') await records.renameStemSet(row.id, title);
        else await records.renameSong(row.id, title);
      } catch (error) {
        warn(`rename of ${row.title} failed`, error);
        set({ notice: { kind: 'renameFailed', name: row.title } });
        return;
      }
      await get().refresh();
    },
    correctDuration: async (songId: number, durationSec: number) => {
      try {
        await deps.records().updateDuration(songId, durationSec);
      } catch (error) {
        warn(`length of song ${String(songId)} not stored`, error);
        return;
      }
      await get().refresh();
    },
  };
}

export function createSongLibraryStore(
  deps: SongLibraryDeps = defaultDeps,
): StoreApi<SongLibraryStore> {
  return createStore<SongLibraryStore>((set, get) => {
    const fileWork = fileWorkTracker();
    const queue = outdatedGridQueue(deps, get);
    const refreshAvailability = availabilityRefresher(deps, set, async () => {
      await get().analyzeUnfinished();
      await queue.restart();
    });
    return {
      ...INITIAL,
      ...readActions(deps, set, get),
      ...importActions(deps, set, get, fileWork),
      ...analysisActions(deps, get, fileWork, queue, refreshAvailability),
      ...rowActions(deps, set, get, queue, fileWork),
      ...songGridSaves(deps, get),
    };
  });
}

export const songLibraryStore = createSongLibraryStore();
