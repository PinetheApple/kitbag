import type { SongLibraryRepository } from '@kitbag/core-db';
import type {
  AnalysisResult,
  ConstantTempoFit,
  ImportedAudio,
  ImportedStemBundle,
  LibraryAvailability,
  LibraryConstants,
  PickedDocument,
  PickedFolder,
  StemBundleCheck,
} from '@kitbag/core-native';

export interface LibraryFiles {
  readonly constants: () => LibraryConstants;
  readonly pickDocuments: () => Promise<readonly PickedDocument[]>;
  readonly pickFolder: () => Promise<PickedFolder | null>;
  readonly sniffUnsupportedFormat: (uri: string) => Promise<string>;
  readonly importAudio: (
    uri: string,
    relativeDir: string,
  ) => Promise<ImportedAudio>;
  readonly enqueueAnalysis: (
    relativePath: string,
    waveformRelativeDir: string,
    replace: boolean,
  ) => void;
  readonly cancelAnalysis: (relativePath: string) => void;
  readonly pendingAnalyses: () => Promise<readonly AnalysisResult[]>;
  readonly acknowledgeAnalysis: (relativePath: string) => void;
  readonly onAnalysis: (
    listener: (result: AnalysisResult) => void,
  ) => () => void;
  readonly deleteLibraryFile: (relativePath: string) => Promise<void>;
  readonly deleteSongFolder: (folderName: string) => Promise<void>;
  readonly checkStemBundle: (
    uri: string,
    isFolder: boolean,
  ) => Promise<StemBundleCheck>;
  readonly importStemBundle: (
    uri: string,
    isFolder: boolean,
  ) => Promise<ImportedStemBundle>;
  readonly listStemFolders: () => Promise<readonly string[]>;
  readonly deleteStemFolder: (folderName: string) => Promise<void>;
  readonly fileAvailability: (
    relativePaths: readonly string[],
  ) => Promise<LibraryAvailability>;
  readonly onDataFolderChanged: (listener: () => void) => () => void;
}

export type SongFileRecord = Awaited<
  ReturnType<SongLibraryRepository['listSongFiles']>
>[number];

export type SongLibraryRecords = Pick<
  SongLibraryRepository,
  | 'list'
  | 'insertSong'
  | 'beginAnalysis'
  | 'claimUnfinishedAnalyses'
  | 'listOutdatedAnalyses'
  | 'applyAnalysis'
  | 'deleteSong'
  | 'restoreSong'
  | 'releaseSongFiles'
  | 'listHeldSongFiles'
  | 'deleteStemSet'
  | 'findStemSetByJobId'
  | 'findStemSetMatches'
  | 'insertStemBundle'
  | 'replaceStemBundle'
  | 'listStemSetFolders'
  | 'listSongFiles'
  | 'listStemFiles'
  | 'renameSong'
  | 'updateDuration'
  | 'renameStemSet'
  | 'saveSongMeterOverride'
  | 'saveSongTempoCorrection'
  | 'listStemSetsWithoutTempo'
  | 'saveStemSetTempo'
>;

export type TempoFitter = (
  beatTimesSec: readonly number[],
  downbeatIndices: readonly number[],
) => Promise<ConstantTempoFit>;

export interface OpenSong {
  readonly id: () => number | null;
  readonly onChange: (listener: () => void) => () => void;
}

export interface SongLibraryRuntime {
  readonly records: SongLibraryRecords;
  readonly files: LibraryFiles;
  readonly openSong: OpenSong;
  readonly fitTempo: TempoFitter;
}

let configured: SongLibraryRuntime | undefined;

export function configureSongLibrary(runtime: SongLibraryRuntime): void {
  if (configured !== undefined && configured !== runtime) {
    throw new Error('Song library is already configured');
  }
  configured = runtime;
}

export function getSongLibrary(): SongLibraryRuntime {
  if (configured === undefined) {
    throw new Error('Song library is not configured');
  }
  return configured;
}
