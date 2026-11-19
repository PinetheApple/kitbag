import { openBackupDatabase } from '@kitbag/core-db/src/backup.test-helper';
import { KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { CODES } from '../songLibrary/store.test-helper.ts';
import { harness, PREPARED, SOURCE, STORED } from './store.test-helper.ts';

const HAT = { ...STORED, slot: 1, uuid: crypto.randomUUID(), name: 'Hat' };

async function storedTwo() {
  const database = openBackupDatabase();
  await database.clickSounds.put(STORED);
  await database.clickSounds.put({ ...HAT, fileName: 'hat.wav' });
  return database;
}

describe('a stored sound the engine refuses', () => {
  it('is reported unavailable and its slot cleared', async () => {
    const h = harness(await storedTwo());
    h.deps.load.mockImplementation((slot) =>
      Promise.resolve(
        slot === 0 ? KB_RESULT.KB_ERROR_INVALID_ARGUMENT : KB_RESULT.KB_OK,
      ),
    );
    await h.state().sync();
    expect(h.state().unavailable).toEqual([0]);
    expect(h.deps.clear).toHaveBeenCalledExactlyOnceWith(0);
    expect(h.state().sounds).toHaveLength(2);
  });

  it('is reported unavailable when the load call itself fails', async () => {
    const h = harness(await storedTwo());
    h.deps.load.mockRejectedValueOnce(new Error('no engine'));
    await h.state().sync();
    expect(h.state().unavailable).toEqual([0]);
  });

  it('is available again once a sync loads it', async () => {
    const h = harness(await storedTwo());
    h.deps.load.mockResolvedValueOnce(KB_RESULT.KB_ERROR_TOO_LONG);
    await h.state().sync();
    await h.state().sync();
    expect(h.state().unavailable).toEqual([]);
  });

  it('is available again once replaced', async () => {
    const h = harness(await storedTwo());
    h.deps.load.mockResolvedValueOnce(KB_RESULT.KB_ERROR_TOO_LONG);
    await h.state().sync();
    await h.state().replace(0, SOURCE, 'New');
    expect(h.state().unavailable).toEqual([]);
  });

  it('is no longer reported once removed', async () => {
    const h = harness(await storedTwo());
    h.deps.load.mockResolvedValueOnce(KB_RESULT.KB_ERROR_TOO_LONG);
    await h.state().sync();
    await h.state().remove(0);
    expect(h.state().unavailable).toEqual([]);
  });

  it('leaves the supported formats readable after sync', async () => {
    const h = harness();
    await h.state().sync();
    expect(h.state().formats).toEqual(CODES.supportedAudioFamilies);
  });
});

describe('sweeping orphaned sound files', () => {
  async function withOrphan() {
    const database = await storedTwo();
    const { files } = database.clickSoundFiles;
    await files.write(STORED.fileName, PREPARED);
    await files.write('hat.wav', PREPARED);
    await files.write('orphan.wav', PREPARED);
    return harness(database);
  }

  it('deletes every file no row names and keeps the rest', async () => {
    const h = await withOrphan();
    await h.state().sweepOrphans();
    expect([...h.stored.keys()].sort()).toEqual(['hat.wav', 'stored.wav']);
  });

  it('waits for an import in flight, then sweeps', async () => {
    const h = await withOrphan();
    const importing = h.state().replace(0, SOURCE, 'Late');
    const sweeping = h.state().sweepOrphans();
    expect(h.stored.has('orphan.wav')).toBe(true);
    await Promise.all([importing, sweeping]);
    expect(h.stored.has('orphan.wav')).toBe(false);
    expect(h.stored.has('file-1.wav')).toBe(true);
  });
});
