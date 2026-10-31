import { countLabel } from '@kitbag/core-design';
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
}

function settled<T>(result: PromiseSettledResult<T>, what: string): T | null {
  if (result.status === 'fulfilled') return result.value;
  console.warn(`[kitbag] could not read ${what}`, result.reason);
  return null;
}

export async function loadStorage(deps: StorageDeps): Promise<StorageSnapshot> {
  const [report, missing] = await Promise.allSettled([
    deps.readReport(),
    deps.findMissing(),
  ]);
  return {
    report: settled(report, 'storage'),
    missing: settled(missing, 'missing files') ?? [],
  };
}

export async function removeMissingThenLoad(
  deps: StorageDeps,
): Promise<StorageSnapshot> {
  try {
    await deps.removeMissing();
  } catch (error) {
    console.warn('[kitbag] could not remove missing files', error);
  }
  return loadStorage(deps);
}

export function removeMissingLabel(count: number): string {
  return `Remove missing files (${String(count)})`;
}

export function removeMissingTitle(count: number): string {
  return `Remove ${countLabel(count, 'missing song', 'missing songs')}?`;
}

export interface StorageLoader {
  readonly refresh: () => Promise<void>;
  readonly removeMissing: () => Promise<void>;
  readonly cancel: () => void;
}

// Work runs one at a time, so a refresh asked for mid-removal reads after it;
// only the newest request publishes.
export function storageLoader(
  deps: StorageDeps,
  publish: (snapshot: StorageSnapshot) => void,
): StorageLoader {
  let queue = Promise.resolve();
  let latest = 0;
  const run = (work: () => Promise<StorageSnapshot>) => {
    latest += 1;
    const request = latest;
    queue = queue.then(async () => {
      const snapshot = await work();
      if (request === latest) publish(snapshot);
    });
    return queue;
  };
  return {
    refresh: () => run(() => loadStorage(deps)),
    removeMissing: () => run(() => removeMissingThenLoad(deps)),
    cancel: () => {
      latest += 1;
    },
  };
}
