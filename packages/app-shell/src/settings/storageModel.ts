import type { LibraryRow } from '@kitbag/core-db';
import type { StorageReport } from '@kitbag/core-native';

export interface StorageDeps {
  readonly readReport: () => Promise<StorageReport>;
  readonly findMissing: () => Promise<readonly LibraryRow[]>;
  readonly removeMissing: () => Promise<void>;
}

export interface StorageSnapshot {
  readonly report: StorageReport | null;
  readonly missing: readonly LibraryRow[];
  readonly removalFailed: boolean;
}

export const EMPTY_STORAGE: StorageSnapshot = {
  report: null,
  missing: [],
  removalFailed: false,
};

function warn(what: string, error: unknown) {
  console.warn(`[kitbag] ${what}`, error);
}

function settled<T>(result: PromiseSettledResult<T>, what: string): T | null {
  if (result.status === 'fulfilled') return result.value;
  warn(`could not read ${what}`, result.reason);
  return null;
}

export async function loadStorage(
  deps: StorageDeps,
  removalFailed = false,
): Promise<StorageSnapshot> {
  const [report, missing] = await Promise.allSettled([
    Promise.resolve().then(deps.readReport),
    Promise.resolve().then(deps.findMissing),
  ]);
  const stillMissing = settled(missing, 'missing files') ?? [];
  return {
    report: settled(report, 'storage'),
    missing: stillMissing,
    removalFailed: removalFailed && stillMissing.length > 0,
  };
}

export async function removeMissingThenLoad(
  deps: StorageDeps,
): Promise<StorageSnapshot> {
  try {
    await Promise.resolve().then(deps.removeMissing);
  } catch (error) {
    warn('could not remove missing files', error);
  }
  return loadStorage(deps, true);
}

export interface StorageLoader {
  readonly refresh: () => Promise<void>;
  readonly removeMissing: () => Promise<void>;
  readonly cancel: () => void;
}

// Serialised: a refresh issued mid-removal must read after the deletes land.
export function storageLoader(
  deps: StorageDeps,
  publish: (snapshot: StorageSnapshot) => void,
): StorageLoader {
  let queue = Promise.resolve();
  let latest = 0;
  let last = EMPTY_STORAGE;
  const run = (work: () => Promise<StorageSnapshot>) => {
    latest += 1;
    const request = latest;
    queue = queue
      .then(async () => {
        last = await work();
        if (request === latest) publish(last);
      })
      .catch((error: unknown) => {
        warn('storage update failed', error);
      });
    return queue;
  };
  return {
    refresh: () => run(() => loadStorage(deps, last.removalFailed)),
    removeMissing: () => run(() => removeMissingThenLoad(deps)),
    cancel: () => {
      latest += 1;
    },
  };
}
