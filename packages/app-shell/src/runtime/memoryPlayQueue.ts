import type { PlayQueueEntry, PlayQueueRepository } from '@kitbag/core-db';

function clampedIndex(position: number | undefined, length: number): number {
  return Math.max(0, Math.min(position ?? length, length));
}

export function createMemoryPlayQueue(): PlayQueueRepository {
  let order: number[] = [];
  let nextId = 1;
  const ids = new Map<number, number>();
  const entries = (): PlayQueueEntry[] =>
    order.map((stemSetId, position) => ({
      id: ids.get(stemSetId) ?? 0,
      stemSetId,
      position,
    }));
  const place = (stemSetId: number, position: number | undefined) => {
    order = order.filter((id) => id !== stemSetId);
    order.splice(clampedIndex(position, order.length), 0, stemSetId);
  };
  const entryOf = (stemSetId: number): PlayQueueEntry => {
    const found = entries().find((entry) => entry.stemSetId === stemSetId);
    if (found === undefined) throw new Error('Play queue entry not found');
    return found;
  };
  return {
    list: () => Promise.resolve(entries()),
    add: (stemSetId, position) => {
      if (!ids.has(stemSetId)) {
        ids.set(stemSetId, nextId);
        nextId += 1;
        place(stemSetId, position);
      }
      return Promise.resolve(entryOf(stemSetId));
    },
    move: (stemSetId, position) => {
      if (ids.has(stemSetId)) place(stemSetId, position);
      return Promise.resolve();
    },
    remove: (stemSetId) => {
      order = order.filter((id) => id !== stemSetId);
      ids.delete(stemSetId);
      return Promise.resolve();
    },
    takeThrough: (stemSetId) => {
      const through = order.indexOf(stemSetId);
      for (const id of order.slice(0, through + 1)) ids.delete(id);
      order = order.slice(through + 1);
      return Promise.resolve();
    },
    clear: () => {
      order = [];
      ids.clear();
      return Promise.resolve();
    },
  };
}
