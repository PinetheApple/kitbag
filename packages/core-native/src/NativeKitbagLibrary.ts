// Paths crossing this boundary are relative; only the native side resolves them.

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

export type PickedBackup = Readonly<{
  name: string;
  bytes: Double;
  contents: string;
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
  durationSec: Double;
  analysisVersion?: Int32;
}>;

export type StemBundleCheck = Readonly<{
  refusal: string | null;
  format: string;
  version: Int32;
  supportedVersion: Int32;
  jobId: string;
  title: string;
  artist: string | null;
  durationSec: Double | null;
  stemCount: Int32;
  maxStems: Int32;
  stemFormat: string;
  supportedStemFormat: string;
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
  hasMix: boolean;
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

export type LibraryAvailability = Readonly<{
  missing: readonly string[];
  unavailable: readonly string[];
  rootAvailable: boolean;
}>;

export type DataFolderVolume = Readonly<{
  /** Null for internal storage. */
  volumeUuid: string | null;
  /** The system's name for a card; null for internal storage. */
  name: string | null;
  state: string;
  inUse: boolean;
  freeBytes: Double;
  totalBytes: Double;
}>;

export type DataFolderVolumes = Readonly<{
  currentVolumeUuid: string | null;
  currentAvailable: boolean;
  /** The current folder's media plus the move's free-space margin; null while it is unmounted. */
  requiredBytes: Double | null;
  volumes: readonly DataFolderVolume[];
}>;

export type MoveStatus = Readonly<{
  phase: string;
  sourceVolumeUuid: string | null;
  targetVolumeUuid: string | null;
  doneBytes: Double;
  totalBytes: Double;
  doneFiles: Int32;
  totalFiles: Int32;
  path: string | null;
  running: boolean;
  switched: boolean;
  paused: boolean;
  awaitingRelease: boolean;
  error: string | null;
}>;

export type MoveFinished = Readonly<{
  outcome: string;
  error: string | null;
  path: string | null;
}>;

export type MoveOutcomes = Readonly<{
  done: string;
  cancelled: string;
  awaitingRelease: string;
  cleanupDeferred: string;
  noMove: string;
  failed: string;
  refused: string;
}>;

export type MoveErrors = Readonly<{
  sourceUnavailable: string;
  targetUnavailable: string;
  targetOccupied: string;
  noSpace: string;
  targetNotWritable: string;
  hashMismatch: string;
  io: string;
  sameLocation: string;
  inProgress: string;
  noMove: string;
  running: string;
  switched: string;
  useInternalRefused: string;
  foregroundRefused: string;
}>;

export type VolumeStates = Readonly<{
  mounted: string;
  readOnly: string;
  unmounted: string;
}>;

export type LibraryConstants = Readonly<{
  songsDir: string;
  stemsDir: string;
  bundleRefusalNotABundle: string;
  bundleRefusalVersion: string;
  bundleRefusalTooManyStems: string;
  bundleRefusalUnreadable: string;
  bundleRefusalNoSpace: string;
  bundleRefusalStemFormat: string;
  failureMissingFile: string;
  failureUnsupported: string;
  failureInterrupted: string;
  failureInternal: string;
  failureUnavailable: string;
  /** Reject code of any call that needs the data folder while its volume is not mounted. */
  dataFolderUnavailable: string;
  /** Reject codes of mixdownStart and shareExport. */
  exportBadFileName: string;
  exportNoActivity: string;
  exportNoShareTarget: string;
  exportShareFailed: string;
  exportMaxBaseNameBytes: Int32;
  supportedAudioFamilies: readonly string[];
  supportedAudioExtensions: readonly string[];
  supportedAudioMimeTypes: readonly string[];
  unsupportedAudioExtensions: readonly string[];
  moveOutcomes: MoveOutcomes;
  /** In the order a move runs them. */
  movePhases: readonly string[];
  /** Reject codes of the move calls, and the error of a failed or refused move. */
  moveErrors: MoveErrors;
  volumeStates: VolumeStates;
}>;

export interface Spec extends TurboModule {
  getConstants(): LibraryConstants;
  pickDocument(): Promise<PickedDocument | null>;
  pickFolder(): Promise<PickedFolder | null>;
  pickBackup(): Promise<PickedBackup | null>;
  shareBackup(fileName: string, contents: string): Promise<void>;
  /** Only a file mixdownStart wrote; rejects E_BAD_FILE_NAME for any other path. */
  shareExport(path: string): Promise<void>;
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
  fileAvailability(
    relativePaths: readonly string[],
  ): Promise<LibraryAvailability>;
  readonly onDataFolderChanged: EventEmitter<void>;
  listVolumes(): Promise<DataFolderVolumes>;
  /** Null moves to internal storage. Resolves once the move is handed to its service. */
  startMove(volumeUuid: string | null): Promise<void>;
  cancelMove(): Promise<void>;
  resumeMove(): Promise<void>;
  /** Discards a paused move's copies; refused while a move runs. */
  undoMove(): Promise<void>;
  moveStatus(): Promise<MoveStatus | null>;
  /** The paths come from the database: an unmounted card cannot be listed. */
  useInternalStorage(awayPaths: readonly string[]): Promise<void>;
  /** Call once no player holds a track loaded before the switch. */
  releaseOldCopies(): void;
  readonly onMoveProgress: EventEmitter<MoveStatus>;
  readonly onMoveFinished: EventEmitter<MoveFinished>;
}

export function getKitbagLibrary(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagLibrary');
}
