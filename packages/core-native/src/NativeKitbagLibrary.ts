// Paths crossing this boundary are relative; only the native side resolves them.

import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type PickedDocument = Readonly<{
  uri: string;
  name: string;
  mimeType: string;
}>;

export type PickedBackup = Readonly<{
  name: string;
  bytes: CodegenTypes.Double;
  contents: string;
}>;

export type IntakeEvent = Readonly<{
  items: readonly PickedDocument[];
  unreadable: CodegenTypes.Int32;
}>;

export type PickedFolder = Readonly<{
  uri: string;
  name: string;
}>;

export type ImportedAudio = Readonly<{
  relativePath: string;
  title: string;
  artist: string;
  durationSec: CodegenTypes.Double;
}>;

export type AnalysisTempo = Readonly<{
  bpm: CodegenTypes.Double;
  anchorSec: CodegenTypes.Double;
  beatsPerBar: CodegenTypes.Int32;
}>;

export type AnalysisResult = Readonly<{
  relativePath: string;
  ok: boolean;
  error: string;
  bpm: CodegenTypes.Double;
  beats: readonly CodegenTypes.Double[];
  downbeats: readonly CodegenTypes.Int32[];
  waveformRelativePath: string;
  durationSec: CodegenTypes.Double;
  analysisVersion?: CodegenTypes.Int32;
  // Absent: the analyser predates the tempo fit. Null: the fit found no steady tempo.
  tempo?: AnalysisTempo | null;
}>;

export type StemBundleCheck = Readonly<{
  refusal: string | null;
  format: string;
  version: CodegenTypes.Int32;
  supportedVersion: CodegenTypes.Int32;
  jobId: string;
  title: string;
  artist: string | null;
  durationSec: CodegenTypes.Double | null;
  stemCount: CodegenTypes.Int32;
  maxStems: CodegenTypes.Int32;
  stemFormat: string;
  supportedStemFormat: string;
}>;

export type ImportedStem = Readonly<{
  name: string;
  relativePath: string;
  waveformRelativePath: string | null;
  frames: CodegenTypes.Double;
  volume: CodegenTypes.Double;
  muted: boolean;
  soloed: boolean;
  pitch: CodegenTypes.Double;
}>;

export type StemBundleSection = Readonly<{
  name: string;
  kind: string;
  color: string;
  startSec: CodegenTypes.Double;
  endSec: CodegenTypes.Double;
}>;

export type StemBundleBar = Readonly<{
  beat: CodegenTypes.Int32;
  beatsPerBar: CodegenTypes.Int32;
}>;

export type StemBundleLyrics = Readonly<{
  synced: string | null;
  plain: string | null;
  offsetSec: CodegenTypes.Double;
  instrumental: boolean;
}>;

export type StemBundleTempo = Readonly<{
  mode: string;
  bpm: CodegenTypes.Double | null;
  anchor: CodegenTypes.Double | null;
  beatsPerBar: CodegenTypes.Int32;
  source: string;
}>;

export type ImportedStemBundle = Readonly<{
  jobId: string;
  title: string;
  songTitle: string | null;
  artist: string | null;
  relativeDir: string;
  durationSec: CodegenTypes.Double;
  sampleRate: CodegenTypes.Int32;
  channels: CodegenTypes.Int32;
  stems: readonly ImportedStem[];
  hasMix: boolean;
  bpm: CodegenTypes.Double | null;
  key: string | null;
  scale: string | null;
  keyConfidence: CodegenTypes.Double | null;
  loudnessLufs: CodegenTypes.Double | null;
  tempoStability: CodegenTypes.Double | null;
  sections: readonly StemBundleSection[];
  beats: readonly CodegenTypes.Double[];
  bars: readonly StemBundleBar[];
  lyrics: StemBundleLyrics | null;
  tempo?: StemBundleTempo | null;
}>;

export type LibraryAudioUsage = Readonly<{
  songs: CodegenTypes.Int32;
  bytes: CodegenTypes.Double;
}>;

export type StemSetUsage = Readonly<{
  count: CodegenTypes.Int32;
  bytes: CodegenTypes.Double;
}>;

export type DatabaseUsage = Readonly<{
  bytes: CodegenTypes.Double;
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
  freeBytes: CodegenTypes.Double;
  totalBytes: CodegenTypes.Double;
  /** Files of songs left on this card when the folder moved off it; 0 while it is unmounted. */
  awayFiles: CodegenTypes.Int32;
  awayBytes: CodegenTypes.Double;
  /** awayBytes plus the free space a move keeps in reserve. */
  awayRequiredBytes: CodegenTypes.Double;
  /** Counted from the away list, so they hold while the card is out. */
  awaySongs: CodegenTypes.Int32;
  awayStemSongs: CodegenTypes.Int32;
}>;

export type DataFolderVolumes = Readonly<{
  currentVolumeUuid: string | null;
  currentAvailable: boolean;
  /** The current folder's media plus the move's free-space margin; null while it is unmounted. */
  requiredBytes: CodegenTypes.Double | null;
  volumes: readonly DataFolderVolume[];
}>;

export type MoveStatus = Readonly<{
  phase: string;
  sourceVolumeUuid: string | null;
  targetVolumeUuid: string | null;
  doneBytes: CodegenTypes.Double;
  totalBytes: CodegenTypes.Double;
  doneFiles: CodegenTypes.Int32;
  totalFiles: CodegenTypes.Int32;
  path: string | null;
  running: boolean;
  switched: boolean;
  paused: boolean;
  awaitingRelease: boolean;
  /** The source is a returned card, not the data folder. */
  cardReturn: boolean;
  error: string | null;
}>;

export type MoveFinished = Readonly<{
  outcome: string;
  error: string | null;
  path: string | null;
}>;

export type MovePhases = Readonly<{
  preflight: string;
  copying: string;
  verifying: string;
  catchUp: string;
  switched: string;
  cleaning: string;
  done: string;
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
  targetLeftovers: string;
  stateUnreadable: string;
  io: string;
  sameLocation: string;
  inProgress: string;
  noMove: string;
  running: string;
  switched: string;
  notOnCard: string;
  cardMounted: string;
  importLockHeld: string;
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
  exportMaxBaseNameBytes: CodegenTypes.Int32;
  /** Reject codes of saveDatabaseCopy when an unfinished journal could not be settled in a private copy. */
  databaseCopyNoSpace: string;
  databaseCopyUnreadable: string;
  backupMimeType: string;
  supportedAudioFamilies: readonly string[];
  supportedAudioExtensions: readonly string[];
  supportedAudioMimeTypes: readonly string[];
  unsupportedAudioExtensions: readonly string[];
  moveOutcomes: MoveOutcomes;
  movePhases: MovePhases;
  /** Reject codes of the move calls, and the error of a failed or refused move. */
  moveErrors: MoveErrors;
  volumeStates: VolumeStates;
}>;

export interface Spec extends TurboModule {
  getConstants(): LibraryConstants;
  pickDocument(): Promise<PickedDocument | null>;
  /** Empty when the user cancels. */
  pickDocuments(): Promise<readonly PickedDocument[]>;
  pickFolder(): Promise<PickedFolder | null>;
  pickBackup(): Promise<PickedBackup | null>;
  readSharedBackup(uri: string): Promise<PickedBackup>;
  takeLaunchIntake(): Promise<IntakeEvent>;
  readonly onIntake: CodegenTypes.EventEmitter<void>;
  shareBackup(fileName: string, contents: string): Promise<void>;
  /** Resolves false when the user cancels the save dialog. */
  saveBackup(fileName: string, contents: string): Promise<boolean>;
  /** Never opens the live database; an unfinished journal is settled in a private copy first. False when cancelled. */
  saveDatabaseCopy(databaseName: string, fileName: string): Promise<boolean>;
  /** Only a file mixdownStart wrote; rejects E_BAD_FILE_NAME for any other path. */
  shareExport(path: string): Promise<void>;
  /** Rejects E_BAD_FILE_NAME for a name unsafe as a click sound file. The name must be
   *  new to each call: two prepares to one name share its .part file. */
  prepareClickSound(sourceUri: string, freshFileName: string): Promise<number>;
  readClickSound(fileName: string): Promise<string>;
  /** Same name rule as prepareClickSound. */
  writeClickSound(fileName: string, wavBase64: string): Promise<void>;
  deleteClickSound(fileName: string): Promise<void>;
  listClickSounds(): Promise<readonly string[]>;
  /** Only while no prepare or write is in flight. */
  clearClickSoundPartials(): Promise<void>;
  /** '' for none or an unreadable file. */
  sniffUnsupportedFormat(uri: string): Promise<string>;
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
  readonly onAnalysis: CodegenTypes.EventEmitter<AnalysisResult>;
  deleteLibraryFile(relativePath: string): Promise<void>;
  deleteSongFolder(folderName: string): Promise<void>;
  checkStemBundle(uri: string, isFolder: boolean): Promise<StemBundleCheck>;
  importStemBundle(uri: string, isFolder: boolean): Promise<ImportedStemBundle>;
  listStemFolders(): Promise<readonly string[]>;
  deleteStemFolder(folderName: string): Promise<void>;
  readWaveform(
    relativePath: string,
    buckets: CodegenTypes.Int32,
  ): Promise<readonly CodegenTypes.Double[]>;
  storageReport(databaseName: string): Promise<StorageReport>;
  fileAvailability(
    relativePaths: readonly string[],
  ): Promise<LibraryAvailability>;
  readonly onDataFolderChanged: CodegenTypes.EventEmitter<void>;
  listVolumes(): Promise<DataFolderVolumes>;
  /** Null moves to internal storage. Resolves once the move is handed to its service. */
  startMove(volumeUuid: string | null): Promise<void>;
  /** Resolves once the move is handed to its service. */
  startCardReturn(volumeUuid: string): Promise<void>;
  cancelMove(): Promise<void>;
  resumeMove(): Promise<void>;
  /** Discards a paused move's copies; refused while a move runs. */
  undoMove(): Promise<void>;
  moveStatus(): Promise<MoveStatus | null>;
  /** The paths come from the database: an unmounted card cannot be listed. */
  useInternalStorage(awayPaths: readonly string[]): Promise<void>;
  /** Call once no player holds a track loaded before the switch. */
  releaseOldCopies(): void;
  readonly onMoveProgress: CodegenTypes.EventEmitter<MoveStatus>;
  readonly onMoveFinished: CodegenTypes.EventEmitter<MoveFinished>;
  /** Free bytes on the database's volume; negative when they cannot be measured. */
  databaseFreeBytes(databaseName: string): CodegenTypes.Double;
  /** False when refused or failed. */
  removeDatabaseCopy(databaseName: string, fileName: string): boolean;
  /** Syncs partName and renames it over fileName; false when refused or failed. */
  replaceDatabaseCopy(
    databaseName: string,
    partName: string,
    fileName: string,
  ): boolean;
}

export function getKitbagLibrary(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagLibrary');
}
