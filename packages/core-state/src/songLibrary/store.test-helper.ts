import { createSongLibraryRepository } from '@kitbag/core-db/src/song-library-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import {
  KB_BEAT_ANALYSIS_VERSION,
  type AnalysisResult,
  type ImportedAudio,
  type ImportedStemBundle,
  type LibraryAvailability,
  type LibraryConstants,
  type PickedDocument,
  type StemBundleCheck,
} from '@kitbag/core-native';
import { afterEach, vi } from 'vitest';

import { DATA_FOLDER_CODES } from '../dataFolder/codes.test-helper.ts';
import { songBadge } from './logic.ts';
import type { LibraryFiles, OpenSong } from './runtime.ts';
import { createSongLibraryStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

export const MP3: PickedDocument = {
  uri: 'content://everlong',
  name: 'Everlong.mp3',
  mimeType: 'audio/mpeg',
};

export const CODES: LibraryConstants = {
  ...DATA_FOLDER_CODES,
  songsDir: 'songs',
  stemsDir: 'stems',
  bundleRefusalNotABundle: 'not-a-bundle',
  bundleRefusalVersion: 'unsupported-version',
  bundleRefusalTooManyStems: 'too-many-stems',
  bundleRefusalUnreadable: 'unreadable',
  bundleRefusalNoSpace: 'no-space',
  bundleRefusalStemFormat: 'unsupported-stem-format',
  failureMissingFile: 'missing-file',
  failureUnsupported: 'unsupported',
  failureInterrupted: 'interrupted',
  failureInternal: 'internal',
  failureUnavailable: 'unavailable',
  dataFolderUnavailable: 'E_DATA_FOLDER_UNAVAILABLE',
  exportBadFileName: 'bad-file-name',
  exportNoActivity: 'no-activity',
  exportNoShareTarget: 'no-share-target',
  exportShareFailed: 'share-failed',
  exportMaxBaseNameBytes: 246,
  databaseCopyUnsettled: 'database-copy-unsettled',
  supportedAudioFamilies: ['WAV', 'MP3', 'FLAC', 'AIFF'],
  supportedAudioExtensions: [
    'wav',
    'rf64',
    'mp3',
    'flac',
    'aiff',
    'aif',
    'aifc',
    'w64',
  ],
  supportedAudioMimeTypes: [
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/vnd.wave',
    'audio/mpeg',
    'audio/mp3',
    'audio/mpeg3',
    'audio/x-mpeg',
    'audio/x-mp3',
    'audio/mpg',
    'audio/flac',
    'audio/x-flac',
    'audio/aiff',
    'audio/x-aiff',
    'audio/aifc',
    'audio/x-aifc',
  ],
  unsupportedAudioExtensions: [
    'm4a',
    'm4b',
    'm4r',
    'mp4',
    'aac',
    'ogg',
    'oga',
    'opus',
    'wma',
    'amr',
    '3gp',
    'mka',
    'webm',
    'ape',
    'wv',
    'ac3',
    'caf',
    'mid',
    'midi',
  ],
};

export const SONG_PATH = 'songs/f1/Everlong.mp3';

export function result(fields: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    relativePath: SONG_PATH,
    ok: true,
    error: '',
    bpm: 158,
    beats: [0.5, 1],
    downbeats: [0],
    waveformRelativePath: 'songs/f1/Everlong.kwav',
    durationSec: 251.3,
    analysisVersion: KB_BEAT_ANALYSIS_VERSION,
    ...fields,
  };
}

export function unversionedResult(
  fields: Partial<AnalysisResult> = {},
): AnalysisResult {
  const entries = Object.entries(result(fields));
  return Object.fromEntries(
    entries.filter(([key]) => key !== 'analysisVersion'),
  ) as AnalysisResult;
}

export function failedResult(
  fields: Partial<AnalysisResult> = {},
): AnalysisResult {
  return unversionedResult({ ...fields, ok: false, error: 'internal' });
}

export const JOB_ID = '0297074f4836';

export function bundleCheck(
  fields: Partial<StemBundleCheck> = {},
): StemBundleCheck {
  return {
    refusal: null,
    format: 'stemdeck-song-bundle',
    version: 1,
    supportedVersion: 1,
    jobId: JOB_ID,
    title: 'Redbone',
    artist: null,
    durationSec: 2,
    stemCount: 2,
    maxStems: 16,
    stemFormat: '',
    supportedStemFormat: 'flac',
    ...fields,
  };
}

export function importedBundle(relativeDir: string): ImportedStemBundle {
  return {
    jobId: JOB_ID,
    title: 'Redbone',
    relativeDir,
    durationSec: 2,
    sampleRate: 44100,
    channels: 2,
    stems: ['vocals', 'drums'].map((name) => ({
      name,
      relativePath: `${relativeDir}/${name}.flac`,
      waveformRelativePath:
        name === 'drums' ? null : `${relativeDir}/${name}.kwav`,
      frames: 88200,
      volume: 1,
      muted: name === 'drums',
      soloed: false,
      pitch: 0,
    })),
    hasMix: true,
    songTitle: null,
    artist: null,
    bpm: 120,
    key: 'D',
    scale: 'major',
    keyConfidence: 70,
    loudnessLufs: -10,
    tempoStability: 90,
    sections: [],
    beats: [0.5, 1],
    bars: [{ beat: 0, beatsPerBar: 4 }],
    lyrics: null,
  };
}

type Native = Omit<LibraryFiles, 'importAudio' | 'pickDocument'>;
type Overridable = 'importAudio' | 'pickDocument' | 'importStemBundle';

export function fakeFiles(
  overrides: Partial<Pick<LibraryFiles, Overridable>> = {},
) {
  const listeners = new Set<(r: AnalysisResult) => void>();
  const folderListeners = new Set<() => void>();
  const disk: { availability: LibraryAvailability } = {
    availability: { missing: [], unavailable: [], rootAvailable: true },
  };
  const stored: AnalysisResult[] = [];
  let bundleCopies = 0;
  const native = {
    constants: vi.fn(() => CODES),
    enqueueAnalysis: vi.fn<Native['enqueueAnalysis']>(),
    cancelAnalysis: vi.fn<Native['cancelAnalysis']>(),
    acknowledgeAnalysis: vi.fn<Native['acknowledgeAnalysis']>(),
    pendingAnalyses: vi.fn(() => Promise.resolve([...stored])),
    onAnalysis: vi.fn((listener: (r: AnalysisResult) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    pickFolder: vi.fn(() =>
      Promise.resolve({ uri: 'content://tree', name: 'Redbone' }),
    ),
    deleteLibraryFile: vi.fn<Native['deleteLibraryFile']>(() =>
      Promise.resolve(),
    ),
    deleteSongFolder: vi.fn<Native['deleteSongFolder']>(() =>
      Promise.resolve(),
    ),
    checkStemBundle: vi.fn<Native['checkStemBundle']>(() =>
      Promise.resolve(bundleCheck()),
    ),
    deleteStemFolder: vi.fn<Native['deleteStemFolder']>(() =>
      Promise.resolve(),
    ),
    listStemFolders: vi.fn<Native['listStemFolders']>(() =>
      Promise.resolve([]),
    ),
    fileAvailability: vi.fn<Native['fileAvailability']>(() =>
      Promise.resolve(disk.availability),
    ),
    onDataFolderChanged: vi.fn((listener: () => void) => {
      folderListeners.add(listener);
      return () => folderListeners.delete(listener);
    }),
  };
  const files = {
    ...native,
    pickDocument: vi.fn(() => Promise.resolve<PickedDocument | null>(MP3)),
    importAudio: vi.fn((_uri: string, dir: string): Promise<ImportedAudio> =>
      Promise.resolve({
        relativePath: `${dir}/Everlong.mp3`,
        title: 'Everlong',
        artist: 'Foo Fighters',
        durationSec: 250,
      }),
    ),
    importStemBundle: vi.fn((): Promise<ImportedStemBundle> => {
      bundleCopies += 1;
      const suffix = bundleCopies === 1 ? '' : `-${String(bundleCopies)}`;
      return Promise.resolve(importedBundle(`stems/${JOB_ID}${suffix}`));
    }),
    ...overrides,
  };
  const emit = (r: AnalysisResult) => {
    for (const listener of listeners) listener(r);
  };
  const changeDataFolder = (availability: LibraryAvailability) => {
    disk.availability = availability;
    for (const listener of folderListeners) listener();
  };
  return { files, emit, stored, listeners, folderListeners, changeDataFolder };
}

export function fakeOpenSong() {
  let openId: number | null = null;
  const listeners = new Set<() => void>();
  const openSong: OpenSong = {
    id: () => openId,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const setOpenSong = (id: number | null) => {
    openId = id;
    for (const listener of listeners) listener();
  };
  return { openSong, setOpenSong };
}

export function setup(fake = fakeFiles()) {
  const handle = openTestDatabase();
  handles.push(handle);
  const records = createSongLibraryRepository(handle);
  let uuids = 0;
  const player = fakeOpenSong();
  const store = createSongLibraryStore({
    records: () => records,
    files: () => fake.files,
    newUuid: () => `f${String((uuids += 1))}`,
    openSong: () => player.openSong,
  });
  return { store, records, handle, ...player, ...fake };
}

export type Store = ReturnType<typeof setup>['store'];

export const badges = (store: Store) =>
  store
    .getState()
    .rows.map((row) =>
      row.kind === 'song' ? [row.title, songBadge(row)] : [row.title],
    );

export const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function importOne(store: Store) {
  await store.getState().importSong();
  const [row] = store.getState().rows;
  if (row === undefined) throw new Error('no row');
  return row;
}
