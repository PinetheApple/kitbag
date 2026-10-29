import type {
  AnalysisResultRecord,
  LibraryRow,
  SongFiles,
} from '@kitbag/core-db';
import type {
  AnalysisResult,
  ImportedAudio,
  LibraryConstants,
  PickedDocument,
} from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  audioFormat,
  fileRemovals,
  isStemArchive,
  parentDir,
  songFolder,
  songRemovals,
  type Removal,
} from './logic.ts';
import { cleanName } from '../names.ts';
import {
  getSongLibrary,
  type LibraryFiles,
  type SongLibraryRecords,
} from './runtime.ts';
import { stemBundleActions } from './stemBundleImport.ts';
import { stemSetRemovals, type BundleRefusal } from './stemBundleLogic.ts';
import {
  importTracker,
  sweepOrphanedStemFolders,
  type ImportTracker,
} from './stemFolderSweep.ts';
import {
  deleteLeftovers,
  loadCodes,
  warn,
  whileImporting,
  type Get,
  type SetState,
} from './storeSupport.ts';

export type LibraryNotice =
  | {
      readonly kind: 'bundleRefused';
      readonly name: string;
      readonly refusal: BundleRefusal;
    }
  | { readonly kind: 'copyFailed'; readonly name: string }
  | { readonly kind: 'addFailed'; readonly name: string }
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
}

export interface ReplacePrompt {
  readonly name: string;
  readonly title: string;
}

export interface SongLibraryActions {
  refresh: () => Promise<void>;
  start: () => Promise<() => void>;
  analyzeUnfinished: () => Promise<void>;
  receiveAnalysis: (result: AnalysisResult) => Promise<void>;
  setQuery: (query: string) => void;
  importSong: () => Promise<void>;
  importStemFolder: () => Promise<void>;
  reanalyze: (songId: number) => Promise<void>;
  deleteRow: (row: LibraryRow) => Promise<void>;
  renameRow: (row: LibraryRow, name: string) => Promise<void>;
  dismissNotice: () => void;
  confirmReplace: () => Promise<void>;
  cancelReplace: () => void;
}

export type SongLibraryStore = SongLibraryState & SongLibraryActions;

export interface SongLibraryDeps {
  readonly records: () => SongLibraryRecords;
  readonly files: () => LibraryFiles;
  readonly newUuid: () => string;
}

const defaultDeps: SongLibraryDeps = {
  records: () => getSongLibrary().records,
  files: () => getSongLibrary().files,
  newUuid: () => crypto.randomUUID(),
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
};

function resultRecord(result: AnalysisResult): AnalysisResultRecord {
  const filePath = result.relativePath;
  if (!result.ok) return { filePath, ok: false, error: result.error };
  return {
    filePath,
    ok: true,
    bpm: result.bpm > 0 ? result.bpm : null,
    beats: result.beats,
    downbeats: result.downbeats,
    waveformPath:
      result.waveformRelativePath === '' ? null : result.waveformRelativePath,
  };
}

function enqueue(files: LibraryFiles, song: SongFiles, replace: boolean) {
  files.enqueueAnalysis(song.filePath, parentDir(song.filePath), replace);
}

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

type ImportOutcome =
  | { readonly ok: true; readonly song: SongFiles }
  | { readonly ok: false; readonly kind: 'copyFailed' | 'addFailed' };

async function importAudio(
  deps: SongLibraryDeps,
  doc: PickedDocument,
  songsDir: string,
): Promise<ImportOutcome> {
  const files = deps.files();
  const uuid = deps.newUuid();
  let imported: ImportedAudio;
  try {
    imported = await files.importAudio(doc.uri, songFolder(songsDir, uuid));
  } catch (error) {
    warn(`copy of ${doc.name} failed`, error);
    return { ok: false, kind: 'copyFailed' };
  }
  const song = { uuid, filePath: imported.relativePath, waveformPath: null };
  try {
    await deps.records().insertSong({
      uuid,
      title: imported.title,
      artist: imported.artist,
      filePath: imported.relativePath,
      durationSec: imported.durationSec,
      format: audioFormat(imported.relativePath),
    });
  } catch (error) {
    warn(`adding ${doc.name} failed`, error);
    await deleteLeftovers(files, songRemovals(song, songsDir), doc.name);
    return { ok: false, kind: 'addFailed' };
  }
  return { ok: true, song };
}

function importActions(
  deps: SongLibraryDeps,
  set: SetState,
  get: Get,
  imports: ImportTracker,
) {
  const bundles = stemBundleActions(deps, set, get, imports);
  let picking = false;
  const pick = async <T>(open: () => Promise<T | null>) => {
    if (picking) return null;
    picking = true;
    set({ notice: null });
    try {
      return await open();
    } catch (error) {
      warn('picker failed', error);
      set({ notice: { kind: 'pickerFailed' } });
      return null;
    } finally {
      picking = false;
    }
  };
  const importDocument = async (doc: PickedDocument) => {
    await whileImporting(set, get, doc.name, async () => {
      const codes = loadCodes(deps, get);
      const outcome: ImportOutcome =
        codes === null
          ? { ok: false, kind: 'copyFailed' }
          : await importAudio(deps, doc, codes.songsDir);
      if (outcome.ok) enqueue(deps.files(), outcome.song, false);
      else set({ notice: { kind: outcome.kind, name: doc.name } });
      set({ codes });
    });
    await get().refresh();
  };
  return {
    importSong: async () => {
      const doc = await pick(() => deps.files().pickDocument());
      if (doc === null) return;
      if (isStemArchive(doc))
        await bundles.importBundle(
          { ...doc, isFolder: false },
          { announce: true },
        );
      else await importDocument(doc);
    },
    importStemFolder: async () => {
      const folder = await pick(() => deps.files().pickFolder());
      if (folder !== null)
        await bundles.importBundle({ ...folder, isFolder: true });
    },
    confirmReplace: bundles.confirmReplace,
    cancelReplace: bundles.cancelReplace,
  };
}

async function deleteRecord(
  deps: SongLibraryDeps,
  row: LibraryRow,
  codes: LibraryConstants | null,
): Promise<Removal[]> {
  const records = deps.records();
  if (row.kind === 'stems')
    return stemSetRemovals(
      await records.deleteStemSet(row.id),
      codes?.stemsDir ?? null,
    );
  const song = await records.deleteSong(row.id);
  if (song === undefined) return [];
  deps.files().cancelAnalysis(song.filePath);
  return songRemovals(song, codes?.songsDir ?? null);
}

function analysisActions(
  deps: SongLibraryDeps,
  get: Get,
  imports: ImportTracker,
) {
  // A result can arrive both as an event and from pendingAnalyses, so applying
  // it must be idempotent; it is acknowledged only once it is stored.
  const receiveAnalysis = async (result: AnalysisResult) => {
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
  };
  const analyzeUnfinished = async () => {
    const files = deps.files();
    for (const song of await deps.records().claimUnfinishedAnalyses())
      enqueue(files, song, false);
    await get().refresh();
  };
  return {
    receiveAnalysis,
    analyzeUnfinished,
    start: async () => {
      const files = deps.files();
      const unsubscribe = files.onAnalysis((result) => {
        void receiveAnalysis(result);
      });
      for (const result of await files.pendingAnalyses())
        await receiveAnalysis(result);
      await analyzeUnfinished();
      await sweepOrphanedStemFolders(deps, get, imports);
      return unsubscribe;
    },
    reanalyze: async (songId: number) => {
      const song = await deps.records().beginAnalysis(songId);
      if (song !== undefined) enqueue(deps.files(), song, true);
      await get().refresh();
    },
  };
}

function rowActions(deps: SongLibraryDeps, set: SetState, get: Get) {
  return {
    deleteRow: async (row: LibraryRow) => {
      let removals: Removal[];
      try {
        removals = await deleteRecord(deps, row, loadCodes(deps, get));
      } catch (error) {
        warn(`delete of ${row.title} failed`, error);
        set({ notice: { kind: 'deleteFailed', name: row.title } });
        return;
      }
      await get().refresh();
      await deleteLeftovers(deps.files(), removals, row.title);
    },
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
  };
}

export function createSongLibraryStore(
  deps: SongLibraryDeps = defaultDeps,
): StoreApi<SongLibraryStore> {
  return createStore<SongLibraryStore>((set, get) => {
    const imports = importTracker();
    return {
      ...INITIAL,
      ...readActions(deps, set, get),
      ...importActions(deps, set, get, imports),
      ...analysisActions(deps, get, imports),
      ...rowActions(deps, set, get),
    };
  });
}

export const songLibraryStore = createSongLibraryStore();
