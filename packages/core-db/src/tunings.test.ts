import { afterEach, describe, expect, it } from 'vitest';

import type { NewTuning } from './repository';
import { tunings } from './schema';
import { openTestDatabase } from './sqlite.test-helper';
import { createTuningRepository } from './tuning-repository';
import { INSTRUMENTS, MAX_STRINGS } from './tuning-rules';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, repo: createTuningRepository(handle) };
}

const OPEN_G: NewTuning = {
  name: 'Open G',
  instrument: INSTRUMENTS.guitar,
  notes: [38, 43, 50, 55, 59, 62],
};

describe('tuning repository', () => {
  it('round-trips a tuning through create and list', async () => {
    const { repo } = setup();
    const created = await repo.create(OPEN_G);
    expect(created).toEqual({
      ...OPEN_G,
      id: created.id,
      uuid: expect.stringMatching(/^[0-9a-f-]{36}$/) as unknown,
    });
    expect(await repo.list()).toEqual([created]);
  });

  it('stores notes as one byte per string, low string first', async () => {
    const { handle, repo } = setup();
    await repo.create(OPEN_G);
    const [row] = await handle.db.select().from(tunings);
    expect(row?.notes).toEqual(Uint8Array.from(OPEN_G.notes));
  });

  it('lists in creation order', async () => {
    const { repo } = setup();
    await repo.create(OPEN_G);
    await repo.create({ ...OPEN_G, name: 'Bass', instrument: 1, notes: [28] });
    expect((await repo.list()).map((tuning) => tuning.name)).toEqual([
      'Open G',
      'Bass',
    ]);
  });

  it('updates only the given fields and keeps the identity', async () => {
    const { repo } = setup();
    const created = await repo.create(OPEN_G);
    await repo.update(created.id, {
      instrument: INSTRUMENTS.ukulele,
      notes: [67, 60, 64, 69],
    });
    expect(await repo.list()).toEqual([
      {
        ...created,
        instrument: INSTRUMENTS.ukulele,
        notes: [67, 60, 64, 69],
      },
    ]);
  });

  it('refuses to update a missing tuning', async () => {
    const { repo } = setup();
    await expect(repo.update(99, { name: 'Gone' })).rejects.toThrow(
      'Tuning 99 not found',
    );
  });

  it('deletes a tuning and leaves the others', async () => {
    const { repo } = setup();
    const doomed = await repo.create(OPEN_G);
    const kept = await repo.create({ ...OPEN_G, name: 'Kept' });
    await repo.delete(doomed.id);
    expect(await repo.list()).toEqual([kept]);
  });

  it.each<[string, Partial<NewTuning>, string]>([
    ['no strings', { notes: [] }, 'notes'],
    [
      'too many strings',
      { notes: Array.from({ length: MAX_STRINGS + 1 }, () => 40) },
      'notes',
    ],
    ['a note above 127', { notes: [40, 128] }, 'notes'],
    ['a negative note', { notes: [-1] }, 'notes'],
    ['a fractional note', { notes: [40.5] }, 'notes'],
    ['an unknown instrument', { instrument: 4 }, 'instrument'],
    ['a negative instrument', { instrument: -1 }, 'instrument'],
  ])('refuses %s on create and update', async (_label, bad, field) => {
    const { repo } = setup();
    await expect(repo.create({ ...OPEN_G, ...bad })).rejects.toThrow(
      `Tuning ${field}:`,
    );
    const created = await repo.create(OPEN_G);
    await expect(repo.update(created.id, bad)).rejects.toThrow(
      `Tuning ${field}:`,
    );
    expect(await repo.list()).toEqual([created]);
  });

  it('accepts the bounds: one string, twelve strings, notes 0 and 127', async () => {
    const { repo } = setup();
    await repo.create({ ...OPEN_G, notes: [0] });
    await repo.create({
      ...OPEN_G,
      instrument: INSTRUMENTS.other,
      notes: [...Array.from({ length: MAX_STRINGS - 1 }, () => 60), 127],
    });
    expect(await repo.list()).toHaveLength(2);
  });
});
