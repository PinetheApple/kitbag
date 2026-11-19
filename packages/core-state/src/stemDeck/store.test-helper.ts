import type { ExistingStemSet } from '@kitbag/core-db';
import type {
  StemDeckConstants,
  StemDeckScan,
  StemDeckImportItem,
  StemDeckImportSnapshot,
  StemDeckProbe,
  StemDeckText,
} from '@kitbag/core-native';
import { vi } from 'vitest';

import type { PermissionAnswer } from '../permission.ts';
import type { BundleAddOutcome } from '../songLibrary/stemBundleLogic.ts';
import type { StemDeckCamera, StemDeckNative } from './runtime.ts';
import { createStemDeckStore, type StemDeckDeps } from './store.ts';

export const CODES: StemDeckConstants = {
  unknownBytes: -1,
  hasCamera: true,
  scanRead: 'read',
  scanTypeAddress: 'typeAddress',
  scanUnavailable: 'unavailable',
  trustPinned: 'pinned',
  trustSystem: 'system',
  trustNew: 'new',
  trustChanged: 'changed',
  trustPlain: 'plain',
  endpointHealth: 'health',
  endpointJobs: 'jobs',
  endpointSetlists: 'setlists',
  stateWaiting: 'waiting',
  statePreparing: 'preparing',
  stateDownloading: 'downloading',
  stateAdding: 'adding',
  stateAdded: 'added',
  stateSkipped: 'skipped',
  stateFailed: 'failed',
  stateNotStarted: 'notStarted',
  settleAdded: 'added',
  settleSkipped: 'skipped',
  settleRefused: 'refused',
  settleFailed: 'failed',
  replaceAdd: 'add',
  replaceJob: 'replaceJob',
  replaceSet: 'replaceSet',
  failureBadAddress: 'badAddress',
  failureUnreachable: 'unreachable',
  failureTimedOut: 'timedOut',
  failureCertificateChanged: 'certificateChanged',
  failureTlsFailed: 'tlsFailed',
  failureNetworkOff: 'networkOff',
  failureNeedsHttps: 'needsHttps',
  failureHttpNotLocal: 'httpNotLocal',
  failureNotFound: 'notFound',
  failureHttpError: 'httpError',
  failureTooLarge: 'tooLarge',
  failureNoSpace: 'noSpace',
  failureLibraryUnavailable: 'libraryUnavailable',
  failureDropped: 'dropped',
  failureCancelled: 'cancelled',
  failureInterrupted: 'interrupted',
  failureTimeLimit: 'timeLimit',
  failureRefused: 'refused',
  failureAddFailed: 'addFailed',
  failureNotAdded: 'notAdded',
};

export const ORIGIN = 'https://192.168.1.50:8443';
export const FINGERPRINT = '4f2a91c07be355d8'.padEnd(64, '0');
export const HEALTH = JSON.stringify({
  name: 'StemDeck',
  status: 'ok',
  version: '2.4.0',
});

export function text(body: string): StemDeckText {
  return { status: 200, contentType: 'application/json', body };
}

export function probe(overrides: Partial<StemDeckProbe> = {}): StemDeckProbe {
  return {
    trust: CODES.trustPinned,
    fingerprint: FINGERPRINT,
    previousFingerprint: null,
    health: text(HEALTH),
    ...overrides,
  };
}

export function job(id: string, title: string, extra: object = {}) {
  return {
    job_id: id.repeat(12),
    status: 'done',
    title,
    display_artist: 'Sinach',
    duration: 481,
    stems: ['vocals', 'drums', 'bass'].map((name) => ({ name, url: '' })),
    ...extra,
  };
}

export const JOBS = JSON.stringify([
  job('a', 'Way Maker'),
  job('b', 'Gratitude'),
  { ...job('c', 'Gone'), status: 'unavailable' },
]);

export const SETLISTS = JSON.stringify([
  { id: 's1', name: 'Sunday worship', song_ids: ['b'.repeat(12)] },
]);

export function item(
  jobId: string,
  state: string,
  overrides: Partial<StemDeckImportItem> = {},
): StemDeckImportItem {
  return {
    jobId,
    title: `Song ${jobId}`,
    replace: CODES.replaceAdd,
    replaceTarget: null,
    state,
    failure: null,
    bytesDone: 0,
    bytesTotal: CODES.unknownBytes,
    bytesFree: CODES.unknownBytes,
    fileUri: null,
    ...overrides,
  };
}

export function snapshot(
  items: StemDeckImportItem[],
  overrides: Partial<StemDeckImportSnapshot> = {},
): StemDeckImportSnapshot {
  return {
    origin: ORIGIN,
    running: true,
    stopReason: null,
    items,
    ...overrides,
  };
}

export function rejection(code: string) {
  return Object.assign(new Error(code), { code });
}

export function fakeNative() {
  let listener: ((s: StemDeckImportSnapshot) => void) | null = null;
  const native = {
    constants: vi.fn(() => CODES),
    probe: vi.fn(() => Promise.resolve(probe())),
    trust: vi.fn(() => Promise.resolve(true)),
    forget: vi.fn(() => Promise.resolve()),
    knownServers: vi.fn<StemDeckNative['knownServers']>(() =>
      Promise.resolve([]),
    ),
    getJson: vi.fn((_origin: string, endpoint: string) =>
      Promise.resolve(text(endpoint === CODES.endpointJobs ? JOBS : SETLISTS)),
    ),
    startImport: vi.fn<StemDeckNative['startImport']>(() =>
      Promise.resolve(true),
    ),
    cancelImport: vi.fn(),
    retryImport: vi.fn(() => Promise.resolve(true)),
    importSnapshot: vi.fn(() =>
      Promise.resolve(snapshot([], { running: false })),
    ),
    settleDownload: vi.fn(),
    setWatching: vi.fn(),
    scanQr: vi.fn<StemDeckNative['scanQr']>(() =>
      Promise.resolve<StemDeckScan | null>(null),
    ),
    onImport: vi.fn((next: (s: StemDeckImportSnapshot) => void) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
  } satisfies StemDeckNative;
  const emit = (s: StemDeckImportSnapshot) => {
    listener?.(s);
  };
  return { native, emit };
}

export function sent(
  native: ReturnType<typeof fakeNative>['native'],
  jobId: string,
): Partial<StemDeckImportItem> {
  const request = native.startImport.mock.calls
    .at(-1)?.[1]
    .find((r) => r.jobId === jobId);
  return request === undefined
    ? {}
    : { replace: request.replace, replaceTarget: request.replaceTarget };
}

export function fakeCamera(answer: PermissionAnswer = 'granted') {
  return {
    check: vi.fn(() => Promise.resolve(answer)),
    request: vi.fn(() => Promise.resolve(answer)),
    openSettings: vi.fn(),
  } satisfies StemDeckCamera;
}

export function setup(
  owned: readonly string[] = [],
  camera = fakeCamera(),
  sameSongs: ReadonlyMap<string, ExistingStemSet> = new Map(),
) {
  const { native, emit } = fakeNative();
  let seen = false;
  const unityNotice = {
    load: vi.fn(() => seen),
    save: vi.fn(() => {
      seen = true;
    }),
  };
  const addFetchedBundle = vi.fn<StemDeckDeps['addFetchedBundle']>(() =>
    Promise.resolve<BundleAddOutcome>({ kind: 'added' }),
  );
  const store = createStemDeckStore({
    native: () => native,
    unityNotice: () => unityNotice,
    addFetchedBundle,
    inLibrary: (jobId) => Promise.resolve(owned.includes(jobId)),
    findSameSong: ({ jobId }) => Promise.resolve(sameSongs.get(jobId)),
    camera: () => camera,
  });
  return { store, native, emit, unityNotice, addFetchedBundle, camera };
}
