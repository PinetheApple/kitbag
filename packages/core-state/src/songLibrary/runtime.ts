import type { SongLibraryRepository } from '@kitbag/core-db';
import type {
  AnalysisResult,
  ImportedAudio,
  ImportedStemBundle,
  LibraryConstants,
  PickedDocument,
  PickedFolder,
  StemBundleCheck,
} from '@kitbag/core-native';

export interface LibraryFiles {
  readonly constants: () => LibraryConstants;
  readonly pickDocument: () => Promise<PickedDocument | null>;
  readonly pickFolder: () => Promise<PickedFolder | null>;
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
}

export type SongLibraryRecords = Pick<
  SongLibraryRepository,
  | 'list'
  | 'insertSong'
  | 'beginAnalysis'
  | 'claimUnfinishedAnalyses'
  | 'applyAnalysis'
  | 'deleteSong'
  | 'deleteStemSet'
  | 'findStemSetByJobId'
  | 'insertStemBundle'
  | 'replaceStemBundle'
  | 'listStemSetFolders'
  | 'renameSong'
  | 'renameStemSet'
>;

export interface SongLibraryRuntime {
  readonly records: SongLibraryRecords;
  readonly files: LibraryFiles;
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
