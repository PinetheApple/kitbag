import { afterEach, describe, expect, it } from 'vitest';

import { createPlayQueueRepository } from './play-queue-repository';
import { insertStemSet } from './stem-entries.test-helper';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

async function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  const queue = createPlayQueueRepository(handle);
  const [a, b, c] = [
    await insertStemSet(handle.db, 'A'),
    await insertStemSet(handle.db, 'B'),
    await insertStemSet(handle.db, 'C'),
  ];
  const order = async () =>
    (await queue.list()).map(({ stemSetId, position }) => [
      stemSetId,
      position,
    ]);
  return { queue, a, b, c, order };
}

describe('play queue repository', () => {
  it('appends, and inserts at a position', async () => {
    const { queue, a, b, c, order } = await setup();
    await queue.add(a);
    await queue.add(b);
    expect(await queue.add(c, 1)).toMatchObject({ stemSetId: c, position: 1 });
    expect(await order()).toEqual([
      [a, 0],
      [c, 1],
      [b, 2],
    ]);
  });

  it('keeps a stem song queued once, where it already is', async () => {
    const { queue, a, b, order } = await setup();
    await queue.add(a);
    await queue.add(b);
    expect(await queue.add(a)).toMatchObject({ stemSetId: a, position: 0 });
    expect(await order()).toEqual([
      [a, 0],
      [b, 1],
    ]);
  });

  it('reorders', async () => {
    const { queue, a, b, c, order } = await setup();
    for (const id of [a, b, c]) await queue.add(id);
    await queue.move(c, 0);
    await queue.move(a, Number.MAX_SAFE_INTEGER);
    expect(await order()).toEqual([
      [c, 0],
      [b, 1],
      [a, 2],
    ]);
  });

  it('removes one stem song and closes the gap', async () => {
    const { queue, a, b, c, order } = await setup();
    for (const id of [a, b, c]) await queue.add(id);
    await queue.remove(b);
    expect(await order()).toEqual([
      [a, 0],
      [c, 1],
    ]);
  });

  it('clears', async () => {
    const { queue, a, b } = await setup();
    await queue.add(a);
    await queue.add(b);
    await queue.clear();
    expect(await queue.list()).toEqual([]);
  });

  it('refuses a stem song that does not exist', async () => {
    const { queue } = await setup();
    await expect(queue.add(Number.MAX_SAFE_INTEGER)).rejects.toHaveProperty(
      'cause.message',
      expect.stringMatching(/FOREIGN KEY/),
    );
  });
});
