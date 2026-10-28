import { createSongLibraryRepository } from '@kitbag/core-db/src/song-library-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import type {
  AnalysisResult,
  ImportedAudio,
  ImportedStemBundle,
  LibraryConstants,
  PickedDocument,
  StemBundleCheck,
} from '@kitbag/core-native';
import { afterEach, vi } from 'vitest';

import { songBadge } from './logic.ts';
import type { LibraryFiles } from './runtime.ts';
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
  songsDir: 'songs',
  stemsDir: 'stems',
  bundleRefusalNotABundle: 'not-a-bundle',
  bundleRefusalVersion: 'unsupported-version',
  bundleRefusalTooManyStems: 'too-many-stems',
  bundleRefusalUnreadable: 'unreadable',
  bundleRefusalNoSpace: 'no-space',
  failureMissingFile: 'missing-file',
  failureUnsupported: 'unsupported',
  failureInterrupted: 'interrupted',
  failureInternal: 'internal',
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
    ...fields,
  };
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
    stemCount: 2,
    maxStems: 16,
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
  return { files, emit, stored, listeners };
}

export function setup(fake = fakeFiles()) {
  const handle = openTestDatabase();
  handles.push(handle);
  const records = createSongLibraryRepository(handle);
  let uuids = 0;
  const store = createSongLibraryStore({
    records: () => records,
    files: () => fake.files,
    newUuid: () => `f${String((uuids += 1))}`,
  });
  return { store, records, handle, ...fake };
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
