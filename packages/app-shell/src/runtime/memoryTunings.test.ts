import { describe, expect, it } from 'vitest';

import { createMemoryTunings, type TextStorage } from './memoryTunings.ts';

function memoryStorage(): TextStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const DROP_D = {
  name: 'Drop D',
  instrument: 0,
  notes: [38, 45, 50, 55, 59, 64],
};

describe('memory tunings repository', () => {
  it('creates, updates and deletes rows', async () => {
    const repo = createMemoryTunings();
    const row = await repo.create(DROP_D);
    await repo.update(row.id, { name: 'Drop D (low)' });
    expect((await repo.list()).map((t) => t.name)).toEqual(['Drop D (low)']);
    await repo.delete(row.id);
    expect(await repo.list()).toEqual([]);
  });

  it('hands out copies, so a caller cannot edit a stored row', async () => {
    const repo = createMemoryTunings();
    const row = await repo.create(DROP_D);
    row.notes[0] = 40;
    expect((await repo.list())[0]?.notes[0]).toBe(38);
  });

  it('rejects an update to a missing row', async () => {
    await expect(
      createMemoryTunings().update(9, { name: 'x' }),
    ).rejects.toThrow('not found');
  });

  it('survives a reload through storage', async () => {
    const storage = memoryStorage();
    const first = await createMemoryTunings(storage).create(DROP_D);
    const reloaded = createMemoryTunings(storage);
    expect(await reloaded.list()).toEqual([first]);
    const second = await reloaded.create(DROP_D);
    expect(second.id).not.toBe(first.id);
  });
});
