import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type {
  Double,
  EventEmitter,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

export type StemDeckText = Readonly<{
  status: Int32;
  contentType: string;
  body: string;
}>;

export type StemDeckProbe = Readonly<{
  trust: string;
  fingerprint: string | null;
  previousFingerprint: string | null;
  health: StemDeckText | null;
}>;

export type StemDeckServer = Readonly<{
  origin: string;
  fingerprint: string | null;
  trustedAt: Double;
  lastUsedAt: Double;
  plain: boolean;
}>;

export type StemDeckImportRequest = Readonly<{
  jobId: string;
  title: string;
  stems: readonly string[];
}>;

export type StemDeckImportItem = Readonly<{
  jobId: string;
  title: string;
  state: string;
  failure: string | null;
  bytesDone: Double;
  bytesTotal: Double;
  bytesFree: Double;
  fileUri: string | null;
}>;

export type StemDeckImportSnapshot = Readonly<{
  origin: string | null;
  running: boolean;
  stopReason: string | null;
  items: readonly StemDeckImportItem[];
}>;

export type StemDeckConstants = Readonly<{
  unknownBytes: Double;
  trustPinned: string;
  trustSystem: string;
  trustNew: string;
  trustChanged: string;
  trustPlain: string;
  endpointHealth: string;
  endpointJobs: string;
  endpointSetlists: string;
  stateWaiting: string;
  statePreparing: string;
  stateDownloading: string;
  stateAdding: string;
  stateAdded: string;
  stateSkipped: string;
  stateFailed: string;
  stateNotStarted: string;
  settleAdded: string;
  settleSkipped: string;
  settleRefused: string;
  settleFailed: string;
  failureBadAddress: string;
  failureUnreachable: string;
  failureTimedOut: string;
  failureCertificateChanged: string;
  failureTlsFailed: string;
  failureNetworkOff: string;
  failureNeedsHttps: string;
  failureHttpNotLocal: string;
  failureNotFound: string;
  failureHttpError: string;
  failureTooLarge: string;
  failureNoSpace: string;
  failureDropped: string;
  failureCancelled: string;
  failureInterrupted: string;
  failureTimeLimit: string;
  failureRefused: string;
  failureAddFailed: string;
  failureNotAdded: string;
}>;

export interface Spec extends TurboModule {
  getConstants(): StemDeckConstants;
  probe(origin: string): Promise<StemDeckProbe>;
  trust(origin: string, fingerprint: string | null): Promise<boolean>;
  forget(origin: string): Promise<void>;
  knownServers(): Promise<readonly StemDeckServer[]>;
  getJson(origin: string, endpoint: string): Promise<StemDeckText>;
  startImport(
    origin: string,
    items: readonly StemDeckImportRequest[],
  ): Promise<boolean>;
  cancelImport(): void;
  retryImport(): Promise<boolean>;
  importSnapshot(): Promise<StemDeckImportSnapshot>;
  settleDownload(jobId: string, outcome: string): void;
  setWatching(watching: boolean): void;
  readonly onImport: EventEmitter<StemDeckImportSnapshot>;
}

export function getKitbagStemDeck(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagStemDeck');
}
