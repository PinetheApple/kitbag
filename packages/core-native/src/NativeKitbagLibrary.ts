// Paths crossing this boundary are relative to the app-owned base directory;
// the native side resolves them.

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  Double,
  EventEmitter,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

export type PickedDocument = Readonly<{
  uri: string;
  name: string;
  mimeType: string;
}>;

export type PickedFolder = Readonly<{
  uri: string;
  name: string;
}>;

export type ImportedAudio = Readonly<{
  relativePath: string;
  title: string;
  artist: string;
  durationSec: Double;
}>;

export type AnalysisResult = Readonly<{
  relativePath: string;
  ok: boolean;
  error: string;
  bpm: Double;
  beats: readonly Double[];
  downbeats: readonly Int32[];
  waveformRelativePath: string;
}>;

export type StemBundleCheck = Readonly<{
  refusal: string | null;
  format: string;
  version: Int32;
  supportedVersion: Int32;
  jobId: string;
  title: string;
  stemCount: Int32;
  maxStems: Int32;
}>;

export type ImportedStem = Readonly<{
  name: string;
  relativePath: string;
  waveformRelativePath: string | null;
  frames: Double;
  volume: Double;
  muted: boolean;
  soloed: boolean;
  pitch: Double;
}>;

export type StemBundleSection = Readonly<{
  name: string;
  kind: string;
  color: string;
  startSec: Double;
  endSec: Double;
}>;

export type StemBundleBar = Readonly<{
  beat: Int32;
  beatsPerBar: Int32;
}>;

export type StemBundleLyrics = Readonly<{
  synced: string | null;
  plain: string | null;
  offsetSec: Double;
  instrumental: boolean;
}>;

export type ImportedStemBundle = Readonly<{
  jobId: string;
  title: string;
  songTitle: string | null;
  artist: string | null;
  relativeDir: string;
  durationSec: Double;
  sampleRate: Int32;
  channels: Int32;
  stems: readonly ImportedStem[];
  bpm: Double | null;
  key: string | null;
  scale: string | null;
  keyConfidence: Double | null;
  loudnessLufs: Double | null;
  tempoStability: Double | null;
  sections: readonly StemBundleSection[];
  beats: readonly Double[];
  bars: readonly StemBundleBar[];
  lyrics: StemBundleLyrics | null;
}>;

export type LibraryAudioUsage = Readonly<{
  songs: Int32;
  bytes: Double;
}>;

export type StemSetUsage = Readonly<{
  count: Int32;
  bytes: Double;
}>;

export type DatabaseUsage = Readonly<{
  bytes: Double;
}>;

export type StorageReport = Readonly<{
  libraryAudio: LibraryAudioUsage;
  stemSets: StemSetUsage;
  database: DatabaseUsage;
  location: string;
}>;

export type LibraryConstants = Readonly<{
  songsDir: string;
  stemsDir: string;
  bundleRefusalNotABundle: string;
  bundleRefusalVersion: string;
  bundleRefusalTooManyStems: string;
  bundleRefusalUnreadable: string;
  bundleRefusalNoSpace: string;
  failureMissingFile: string;
  failureUnsupported: string;
  failureInterrupted: string;
  failureInternal: string;
}>;

export interface Spec extends TurboModule {
  getConstants(): LibraryConstants;
  pickDocument(): Promise<PickedDocument | null>;
  pickFolder(): Promise<PickedFolder | null>;
  importAudio(uri: string, relativeDir: string): Promise<ImportedAudio>;
  enqueueAnalysis(
    relativePath: string,
    waveformRelativeDir: string,
    replace: boolean,
  ): void;
  cancelAnalysis(relativePath: string): void;
  // Results stay stored until acknowledged, so one finished while JS was gone is not lost.
  pendingAnalyses(): Promise<readonly AnalysisResult[]>;
  acknowledgeAnalysis(relativePath: string): void;
  readonly onAnalysis: EventEmitter<AnalysisResult>;
  deleteLibraryFile(relativePath: string): Promise<void>;
  deleteSongFolder(folderName: string): Promise<void>;
  checkStemBundle(uri: string, isFolder: boolean): Promise<StemBundleCheck>;
  importStemBundle(uri: string, isFolder: boolean): Promise<ImportedStemBundle>;
  listStemFolders(): Promise<readonly string[]>;
  deleteStemFolder(folderName: string): Promise<void>;
  readWaveform(
    relativePath: string,
    buckets: Int32,
  ): Promise<readonly Double[]>;
  storageReport(databaseName: string): Promise<StorageReport>;
  missingFiles(relativePaths: readonly string[]): Promise<readonly string[]>;
}

export function getKitbagLibrary(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagLibrary');
}
