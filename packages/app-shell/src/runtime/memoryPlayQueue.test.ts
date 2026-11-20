import { queuedSongOf, type QueuedSong } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { createMemoryPlayQueue } from './memoryPlayQueue.ts';

const stems = (id: number): QueuedSong => ({ kind: 'stems', id });
const song = (id: number): QueuedSong => ({ kind: 'song', id });

const queued = async (queue: ReturnType<typeof createMemoryPlayQueue>) =>
  (await queue.list()).map(queuedSongOf);

describe('memory play queue', () => {
  it('queues a song once, in order', async () => {
    const queue = createMemoryPlayQueue();
    await queue.add(stems(1));
    await queue.add(song(1));
    await queue.add(stems(1));
    expect(await queued(queue)).toEqual([stems(1), song(1)]);
  });

  it('puts a song first when asked', async () => {
    const queue = createMemoryPlayQueue();
    await queue.add(stems(1));
    await queue.add(song(2), 0);
    expect(await queued(queue)).toEqual([song(2), stems(1)]);
  });

  it('moves, removes, takes through and clears', async () => {
    const queue = createMemoryPlayQueue();
    for (const id of [1, 2, 3, 4]) await queue.add(stems(id));
    await queue.move(stems(4), 0);
    expect(await queued(queue)).toEqual([4, 1, 2, 3].map(stems));
    await queue.remove(stems(1));
    await queue.takeThrough(stems(2));
    expect(await queued(queue)).toEqual([stems(3)]);
    await queue.clear();
    expect(await queued(queue)).toEqual([]);
  });

  it('leaves the queue alone when taking through a song it does not hold', async () => {
    const queue = createMemoryPlayQueue();
    await queue.add(stems(1));
    await queue.takeThrough(song(1));
    expect(await queued(queue)).toEqual([stems(1)]);
  });
});
