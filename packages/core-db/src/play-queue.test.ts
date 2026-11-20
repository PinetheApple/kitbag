import { afterEach, describe, expect, it } from 'vitest';

import {
  createPlayQueueRepository,
  queuedSongOf,
  type QueuedSong,
} from './play-queue-repository';
import { insertSong, insertStemSet } from './stem-entries.test-helper';
import { openTestDatabase } from './sqlite.test-helper';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

const stems = (id: number): QueuedSong => ({ kind: 'stems', id });
const song = (id: number): QueuedSong => ({ kind: 'song', id });

async function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  const queue = createPlayQueueRepository(handle);
  const [a, b, c] = [
    stems(await insertStemSet(handle.db, 'A')),
    stems(await insertStemSet(handle.db, 'B')),
    stems(await insertStemSet(handle.db, 'C')),
  ];
  const single = song(await insertSong(handle.db, 'Single'));
  const order = async () =>
    (await queue.list()).map((entry) => [queuedSongOf(entry), entry.position]);
  return { queue, a, b, c, single, order };
}

describe('play queue repository', () => {
  it('appends, and inserts at a position', async () => {
    const { queue, a, b, c, order } = await setup();
    await queue.add(a);
    await queue.add(b);
    expect(await queue.add(c, 1)).toMatchObject({
      stemSetId: c.id,
      position: 1,
    });
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
    expect(await queue.add(a)).toMatchObject({ stemSetId: a.id, position: 0 });
    expect(await order()).toEqual([
      [a, 0],
      [b, 1],
    ]);
  });

  it('queues single songs beside stem songs, each once', async () => {
    const { queue, a, single, order } = await setup();
    await queue.add(a);
    expect(await queue.add(single, 0)).toMatchObject({
      songId: single.id,
      stemSetId: null,
      position: 0,
    });
    await queue.add(single);
    expect(await order()).toEqual([
      [single, 0],
      [a, 1],
    ]);
  });

  it('tells a single song from a stem song with the same id', async () => {
    const { queue, a, single, order } = await setup();
    expect(single.id).toBe(a.id);
    await queue.add(a);
    await queue.add(single);
    await queue.remove(a);
    expect(await order()).toEqual([[single, 0]]);
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

  it('removes one song and closes the gap', async () => {
    const { queue, a, b, single, order } = await setup();
    for (const id of [a, single, b]) await queue.add(id);
    await queue.remove(single);
    expect(await order()).toEqual([
      [a, 0],
      [b, 1],
    ]);
  });

  it('takes a song and everything queued before it, in one step', async () => {
    const { queue, a, b, single, order } = await setup();
    for (const id of [a, single, b]) await queue.add(id);
    await queue.takeThrough(single);
    expect(await order()).toEqual([[b, 0]]);
  });

  it('takes nothing for a song that is not queued', async () => {
    const { queue, a, b, c, order } = await setup();
    await queue.add(a);
    await queue.add(b);
    await queue.takeThrough(c);
    expect(await order()).toEqual([
      [a, 0],
      [b, 1],
    ]);
  });

  it('clears', async () => {
    const { queue, a, single } = await setup();
    await queue.add(a);
    await queue.add(single);
    await queue.clear();
    expect(await queue.list()).toEqual([]);
  });

  it.each([
    ['stem song', stems(Number.MAX_SAFE_INTEGER)],
    ['song', song(Number.MAX_SAFE_INTEGER)],
  ])('refuses a %s that does not exist', async (_, missing) => {
    const { queue } = await setup();
    await expect(queue.add(missing)).rejects.toHaveProperty(
      'cause.message',
      expect.stringMatching(/FOREIGN KEY/),
    );
  });
});
