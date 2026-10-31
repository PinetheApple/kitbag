import type { LibraryRow } from '@kitbag/core-db';
import type { StorageReport } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import {
  loadStorage,
  removeMissingLabel,
  removeMissingTitle,
  removeMissingThenLoad,
  storageLoader,
  type StorageDeps,
} from './storageModel.ts';

const REPORT: StorageReport = {
  libraryAudio: { songs: 2, bytes: 1 },
  stemSets: { count: 0, bytes: 0 },
  database: { bytes: 1 },
  location: '/files',
};

const ROW = { kind: 'song', id: 1, title: 'Everlong' } as LibraryRow;

function deps(missing: readonly LibraryRow[] = [ROW]) {
  const calls: string[] = [];
  const source = {
    calls,
    readReport: vi.fn(() => {
      calls.push('report');
      return Promise.resolve(REPORT);
    }),
    findMissing: vi.fn(() => {
      calls.push('find');
      return Promise.resolve(missing);
    }),
    removeMissing: vi.fn(() => {
      calls.push('remove');
      return Promise.resolve();
    }),
  } satisfies StorageDeps & { calls: string[] };
  return source;
}

describe('loadStorage', () => {
  it('reads the report and the missing rows', async () => {
    expect(await loadStorage(deps())).toEqual({
      report: REPORT,
      missing: [ROW],
    });
  });

  it('keeps the report when the missing-file check fails', async () => {
    const source = deps();
    source.findMissing.mockRejectedValueOnce(new Error('no library'));
    expect(await loadStorage(source)).toEqual({ report: REPORT, missing: [] });
  });

  it('keeps the missing rows when the report fails', async () => {
    const source = deps();
    source.readReport.mockRejectedValueOnce(new Error('no module'));
    expect(await loadStorage(source)).toEqual({ report: null, missing: [ROW] });
  });
});

describe('removeMissingThenLoad', () => {
  it('removes first, then reads what is left', async () => {
    const source = deps([]);
    expect(await removeMissingThenLoad(source)).toEqual({
      report: REPORT,
      missing: [],
    });
    expect(source.calls[0]).toBe('remove');
    expect(source.calls.slice(1).sort()).toEqual(['find', 'report']);
  });

  it('still reloads when the removal fails', async () => {
    const source = deps();
    source.removeMissing.mockRejectedValueOnce(new Error('locked'));
    expect(await removeMissingThenLoad(source)).toEqual({
      report: REPORT,
      missing: [ROW],
    });
  });
});

describe('removeMissingLabel', () => {
  it('names the count of rows it would remove', () => {
    expect(removeMissingLabel(2)).toBe('Remove missing files (2)');
  });

  it('asks about one song or several', () => {
    expect(removeMissingTitle(1)).toBe('Remove 1 missing song?');
    expect(removeMissingTitle(3)).toBe('Remove 3 missing songs?');
  });
});

describe('storageLoader', () => {
  it('reads after a removal that is still running', async () => {
    const source = deps();
    let finishRemoval: () => void = () => undefined;
    source.removeMissing.mockImplementationOnce(() => {
      source.calls.push('remove');
      return new Promise<void>((resolve) => {
        finishRemoval = resolve;
      });
    });
    const publish = vi.fn();
    const loader = storageLoader(source, publish);
    const removal = loader.removeMissing();
    const refresh = loader.refresh();
    await Promise.resolve();
    expect(source.calls).toEqual(['remove']);
    finishRemoval();
    await Promise.all([removal, refresh]);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(source.calls.filter((call) => call === 'report')).toHaveLength(2);
  });

  it('publishes nothing once cancelled', async () => {
    const publish = vi.fn();
    const loader = storageLoader(deps(), publish);
    const refresh = loader.refresh();
    loader.cancel();
    await refresh;
    expect(publish).not.toHaveBeenCalled();
  });
});
