import {
  openBackupDatabase,
  presetValues,
} from '@kitbag/core-db/src/backup.test-helper';
import {
  customSoundId,
  KB_CUSTOM_SOUND_SLOTS,
  KB_DEFAULT_SOUNDS,
  KB_RESULT,
} from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { harness, SOURCE, STORED } from './store.test-helper.ts';

describe('importing a click sound', () => {
  it('prepares it, loads it into the first free slot and stores it', async () => {
    const h = harness();
    const outcome = await h.state().importSound(SOURCE, 'Rimshot');
    const sound = {
      slot: 0,
      uuid: '00000000-0000-4000-8000-000000000001',
      name: 'Rimshot',
      fileName: 'file-1.wav',
    };
    expect(outcome).toEqual({ kind: 'saved', sound });
    expect(h.deps.prepare).toHaveBeenCalledWith(SOURCE, 'file-1.wav');
    expect(h.deps.load).toHaveBeenCalledWith(0, 'file-1.wav');
    expect(await h.database.clickSounds.list()).toEqual([sound]);
    expect(h.state().sounds).toEqual([sound]);
  });

  it('takes the next slot, then reports every slot full', async () => {
    const h = harness();
    for (let slot = 0; slot < KB_CUSTOM_SOUND_SLOTS; slot += 1)
      expect(await h.state().importSound(SOURCE, 'Sound')).toMatchObject({
        kind: 'saved',
        sound: { slot },
      });
    expect(await h.state().importSound(SOURCE, 'One more')).toEqual({
      kind: 'full',
    });
  });

  it('stores nothing when the core refuses the file', async () => {
    const h = harness();
    h.deps.prepare.mockResolvedValueOnce(KB_RESULT.KB_ERROR_TOO_LONG);
    expect(await h.state().importSound(SOURCE, 'Long')).toEqual({
      kind: 'refused',
      result: KB_RESULT.KB_ERROR_TOO_LONG,
    });
    expect(h.deps.load).not.toHaveBeenCalled();
    expect(await h.database.clickSounds.list()).toEqual([]);
  });

  it('deletes the prepared file and stores nothing when the engine will not load it', async () => {
    const h = harness();
    h.deps.load.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INVALID_ARGUMENT);
    expect(await h.state().importSound(SOURCE, 'Bad')).toEqual({
      kind: 'refused',
      result: KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
    });
    expect(h.stored.size).toBe(0);
    expect(await h.database.clickSounds.list()).toEqual([]);
  });

  it('puts the stored sound back in the engine when storing the new one fails', async () => {
    const h = harness();
    await h.state().importSound(SOURCE, 'Rimshot');
    h.store.setState({ sounds: [] });
    vi.spyOn(h.database.clickSounds, 'put').mockRejectedValueOnce(
      new Error('disk I/O error'),
    );
    await expect(h.state().replace(0, SOURCE, 'Hat')).rejects.toThrow(
      'disk I/O error',
    );
    expect(h.deps.load).toHaveBeenLastCalledWith(0, 'file-1.wav');
    expect([...h.stored.keys()]).toEqual(['file-1.wav']);
  });

  it('picks a free slot from the database, not a list sync has not filled yet', async () => {
    const database = openBackupDatabase();
    await database.clickSounds.put(STORED);
    const h = harness(database);
    const outcome = await h.state().importSound(SOURCE, 'Rimshot');
    expect(outcome).toMatchObject({ kind: 'saved', sound: { slot: 1 } });
    expect(await database.clickSounds.get(STORED.slot)).toEqual(STORED);
    expect(h.deps.load).not.toHaveBeenCalledWith(
      STORED.slot,
      expect.anything(),
    );
  });

  it('reports every slot full without preparing when the database holds them all', async () => {
    const database = openBackupDatabase();
    for (let slot = 0; slot < KB_CUSTOM_SOUND_SLOTS; slot += 1)
      await database.clickSounds.put({ ...STORED, slot });
    const h = harness(database);
    expect(await h.state().importSound(SOURCE, 'Rimshot')).toEqual({
      kind: 'full',
    });
    expect(h.deps.prepare).not.toHaveBeenCalled();
  });

  it('keeps a sound stored after the free-slot check and reports full', async () => {
    const database = openBackupDatabase();
    await database.clickSounds.put(STORED);
    vi.spyOn(database.clickSounds, 'list').mockResolvedValueOnce([]);
    const h = harness(database);
    expect(await h.state().importSound(SOURCE, 'Rimshot')).toEqual({
      kind: 'full',
    });
    expect(await database.clickSounds.get(STORED.slot)).toEqual(STORED);
    expect(h.deps.load).not.toHaveBeenCalled();
    expect(h.stored.size).toBe(0);
  });

  it('runs one import at a time', async () => {
    const h = harness();
    const first = h.state().importSound(SOURCE, 'One');
    expect(h.state().importing).toBe(true);
    expect(await h.state().importSound(SOURCE, 'Two')).toEqual({
      kind: 'busy',
    });
    await first;
    expect(h.state().importing).toBe(false);
  });
});

describe('managing click sounds', () => {
  it('replaces a slot with a new sound and deletes the old file', async () => {
    const h = harness();
    const first = await h.state().importSound(SOURCE, 'Rimshot');
    const replaced = await h.state().replace(0, SOURCE, 'Hat');
    expect(replaced).toMatchObject({
      kind: 'saved',
      sound: { slot: 0, name: 'Hat', fileName: 'file-2.wav' },
    });
    expect(first.kind === 'saved' && replaced.kind === 'saved').toBe(true);
    if (first.kind !== 'saved' || replaced.kind !== 'saved') return;
    expect(replaced.sound.uuid).not.toBe(first.sound.uuid);
    expect([...h.stored.keys()]).toEqual(['file-2.wav']);
  });

  it('renames a sound', async () => {
    const h = harness();
    await h.state().importSound(SOURCE, 'Rimshot');
    await h.state().rename(0, 'Rim click');
    expect(h.state().sounds).toMatchObject([{ slot: 0, name: 'Rim click' }]);
  });

  it('removes a sound from the engine and every song, counts the songs and deletes its file once Undo is gone', async () => {
    const h = harness();
    await h.state().importSound(SOURCE, 'Rimshot');
    const id = customSoundId(0);
    await h.database.presets.create({
      ...presetValues('Uses it', null),
      sound: id,
      perAccentSounds: new Uint8Array([id, id]),
    });
    expect(await h.state().remove(0)).toBe(1);
    expect(h.deps.clear).toHaveBeenCalledWith(0);
    expect(h.state().sounds).toEqual([]);
    expect(h.deps.afterRemove).toHaveBeenCalledWith(id);
    const [song] = await h.database.presets.list();
    expect(song).toMatchObject({ sound: KB_DEFAULT_SOUNDS.normal });
    expect(h.stored.size).toBe(1);
    await h.state().dismissRemoved();
    expect(h.stored.size).toBe(0);
    expect(h.state().removed).toBeNull();
  });

  it('Undo puts a removed sound back in its slot, the engine and every song', async () => {
    const h = harness();
    await h.state().importSound(SOURCE, 'Rimshot');
    const id = customSoundId(0);
    const song = await h.database.presets.create({
      ...presetValues('Uses it', null),
      sound: id,
      perAccentSounds: new Uint8Array([id, id]),
    });
    const released = {
      metronome: { normal: id, accent: id },
      standalone: null,
    };
    h.deps.afterRemove.mockResolvedValueOnce(released);
    await h.state().remove(0);
    h.deps.load.mockClear();
    await h.state().undoRemove();
    expect(h.state().sounds).toMatchObject([{ slot: 0, name: 'Rimshot' }]);
    expect(h.deps.load).toHaveBeenCalledExactlyOnceWith(0, 'file-1.wav');
    expect(h.stored.has('file-1.wav')).toBe(true);
    expect(await h.database.presets.get(song.id)).toEqual(song);
    expect(h.deps.afterRestore).toHaveBeenCalledWith(id, released);
    expect(h.state().removed).toBeNull();
  });

  it('deletes the file of an earlier remove when another sound is removed', async () => {
    const h = harness();
    await h.state().importSound(SOURCE, 'Rimshot');
    await h.state().importSound(SOURCE, 'Hat');
    await h.state().remove(0);
    await h.state().remove(1);
    expect([...h.stored.keys()]).toEqual(['file-2.wav']);
    expect(h.state().removed?.sound.name).toBe('Hat');
  });
});

describe('syncing the engine with the stored sounds', () => {
  it('loads every stored sound and clears every empty slot', async () => {
    const database = openBackupDatabase();
    await database.clickSounds.put({
      slot: 1,
      uuid: crypto.randomUUID(),
      name: 'Hat',
      fileName: 'hat.wav',
    });
    const h = harness(database);
    await h.state().sync();
    expect(h.deps.load).toHaveBeenCalledExactlyOnceWith(1, 'hat.wav');
    expect(h.deps.clear).toHaveBeenCalledExactlyOnceWith(0);
    expect(h.state().sounds).toMatchObject([{ slot: 1, name: 'Hat' }]);
  });
});
