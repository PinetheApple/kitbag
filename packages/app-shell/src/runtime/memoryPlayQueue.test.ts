import { describe, expect, it } from 'vitest';

import { createMemoryPlayQueue } from './memoryPlayQueue.ts';

const ids = async (queue: ReturnType<typeof createMemoryPlayQueue>) =>
  (await queue.list()).map((entry) => entry.stemSetId);

describe('memory play queue', () => {
  it('queues a song once, in order', async () => {
    const queue = createMemoryPlayQueue();
    await queue.add(1);
    await queue.add(2);
    await queue.add(1);
    expect(await ids(queue)).toEqual([1, 2]);
  });

  it('moves, removes, takes through and clears', async () => {
    const queue = createMemoryPlayQueue();
    for (const id of [1, 2, 3, 4]) await queue.add(id);
    await queue.move(4, 0);
    expect(await ids(queue)).toEqual([4, 1, 2, 3]);
    await queue.remove(1);
    await queue.takeThrough(2);
    expect(await ids(queue)).toEqual([3]);
    await queue.clear();
    expect(await ids(queue)).toEqual([]);
  });

  it('leaves the queue alone when taking through a song it does not hold', async () => {
    const queue = createMemoryPlayQueue();
    await queue.add(1);
    await queue.takeThrough(9);
    expect(await ids(queue)).toEqual([1]);
  });
});
