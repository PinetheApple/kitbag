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

export type LibraryConstants = Readonly<{
  songsDir: string;
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
}

export function getKitbagLibrary(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagLibrary');
}
