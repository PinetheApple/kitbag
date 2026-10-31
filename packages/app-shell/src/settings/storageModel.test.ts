import type { LibraryRow } from '@kitbag/core-db';
import type { StorageReport } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import {
  loadStorage,
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
      removalFailed: false,
    });
  });

  it('keeps the report when the missing-file check fails', async () => {
    const source = deps();
    source.findMissing.mockRejectedValueOnce(new Error('no library'));
    expect(await loadStorage(source)).toMatchObject({
      report: REPORT,
      missing: [],
    });
  });

  it('keeps the missing rows when the report fails', async () => {
    const source = deps();
    source.readReport.mockRejectedValueOnce(new Error('no module'));
    expect(await loadStorage(source)).toMatchObject({
      report: null,
      missing: [ROW],
    });
  });

  it('turns a dependency that throws before returning into a failed read', async () => {
    const source = deps();
    source.readReport.mockImplementationOnce(() => {
      throw new Error('no native module');
    });
    expect(await loadStorage(source)).toMatchObject({
      report: null,
      missing: [ROW],
    });
  });
});

describe('removeMissingThenLoad', () => {
  it('removes first, then reads what is left', async () => {
    const source = deps([]);
    expect(await removeMissingThenLoad(source)).toEqual({
      report: REPORT,
      missing: [],
      removalFailed: false,
    });
    expect(source.calls[0]).toBe('remove');
    expect(source.calls.slice(1).sort()).toEqual(['find', 'report']);
  });

  it('reports a failure when rows are still missing afterwards', async () => {
    const source = deps();
    source.removeMissing.mockRejectedValueOnce(new Error('locked'));
    expect(await removeMissingThenLoad(source)).toEqual({
      report: REPORT,
      missing: [ROW],
      removalFailed: true,
    });
  });

  it('reports a failure even when the delete path swallowed its error', async () => {
    expect(await removeMissingThenLoad(deps())).toMatchObject({
      missing: [ROW],
      removalFailed: true,
    });
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
    await vi.waitFor(() => {
      expect(source.calls).toEqual(['remove']);
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
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

  it('keeps the failure through a refresh while rows are still missing', async () => {
    const publish = vi.fn();
    const loader = storageLoader(deps(), publish);
    await loader.removeMissing();
    await loader.refresh();
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ removalFailed: true }),
    );
  });

  it('clears the failure once nothing is missing', async () => {
    const source = deps();
    const publish = vi.fn();
    const loader = storageLoader(source, publish);
    await loader.removeMissing();
    source.findMissing.mockResolvedValue([]);
    await loader.refresh();
    expect(publish).toHaveBeenLastCalledWith(
      expect.objectContaining({ removalFailed: false }),
    );
  });

  it('keeps running after a task fails', async () => {
    const publish = vi.fn().mockImplementationOnce(() => {
      throw new Error('gone');
    });
    const loader = storageLoader(deps(), publish);
    await loader.refresh();
    await loader.refresh();
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
