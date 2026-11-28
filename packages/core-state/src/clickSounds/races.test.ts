import { openBackupDatabase } from '@kitbag/core-db/src/backup.test-helper';
import { KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { harness, PREPARED, SOURCE } from './store.test-helper.ts';

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function withRimshot() {
  const h = harness(openBackupDatabase());
  await h.state().importSound(SOURCE, 'Rimshot');
  return h;
}

function holdPrepare(h: Awaited<ReturnType<typeof withRimshot>>) {
  const gate = deferred<undefined>();
  h.deps.prepare.mockImplementationOnce(async (_uri, fileName) => {
    await gate.promise;
    await h.database.clickSoundFiles.files.write(fileName, PREPARED);
    return KB_RESULT.KB_OK;
  });
  return gate;
}

describe('a change while a Replace prepares', () => {
  it('a Remove waits for it, and the sound stays removed', async () => {
    const h = await withRimshot();
    const gate = holdPrepare(h);
    const replacing = h.state().replace(0, SOURCE, 'Hat');
    const removing = h.state().remove(0);
    gate.resolve(undefined);
    await Promise.all([replacing, removing]);
    await h.state().dismissRemoved();
    expect(await h.database.clickSounds.list()).toEqual([]);
    expect(h.stored.size).toBe(0);
    expect(h.deps.clear).toHaveBeenLastCalledWith(0);
    expect(h.deps.load).not.toHaveBeenCalledAfter(h.deps.clear);
  });

  it('a Rename waits for it and is kept', async () => {
    const h = await withRimshot();
    const gate = holdPrepare(h);
    const replacing = h.state().replace(0, SOURCE, 'Hat');
    const renaming = h.state().rename(0, 'Mine');
    gate.resolve(undefined);
    await Promise.all([replacing, renaming]);
    expect(h.state().sounds).toMatchObject([{ slot: 0, name: 'Mine' }]);
  });

  it('a sync after a restore waits for it and loads the new file', async () => {
    const h = await withRimshot();
    const gate = deferred<undefined>();
    h.deps.load.mockImplementationOnce(async () => {
      await gate.promise;
      return KB_RESULT.KB_OK;
    });
    const replacing = h.state().replace(0, SOURCE, 'Hat');
    await vi.waitFor(() => {
      expect(h.deps.load).toHaveBeenCalledTimes(2);
    });
    const syncing = h.state().sync();
    gate.resolve(undefined);
    await Promise.all([replacing, syncing]);
    expect(h.deps.load).toHaveBeenLastCalledWith(0, 'file-2.wav');
  });
});

describe('a sweep racing a restore', () => {
  it('keeps the file the restore writes before its row', async () => {
    const h = harness(openBackupDatabase());
    const rowWritten = deferred<undefined>();
    const restoring = h.lock.run(async () => {
      await h.database.clickSoundFiles.files.write('restored.wav', PREPARED);
      await rowWritten.promise;
      await h.database.clickSounds.put({
        slot: 0,
        uuid: crypto.randomUUID(),
        name: 'Restored',
        fileName: 'restored.wav',
      });
    });
    await vi.waitFor(() => {
      expect(h.stored.has('restored.wav')).toBe(true);
    });
    const sweeping = h.state().sweepOrphans();
    await new Promise((done) => setTimeout(done, 0));
    rowWritten.resolve(undefined);
    await Promise.all([restoring, sweeping]);
    expect(h.stored.has('restored.wav')).toBe(true);
  });

  it('clears stale partial files', async () => {
    const h = harness(openBackupDatabase());
    await h.state().sweepOrphans();
    expect(h.deps.clearPartials).toHaveBeenCalledOnce();
  });
});
