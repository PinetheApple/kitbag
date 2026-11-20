import {
  queuedSongOf,
  sameQueuedSong,
  type PlayQueueEntry,
  type PlayQueueRepository,
  type QueuedSong,
} from '@kitbag/core-db';

function clampedIndex(position: number | undefined, length: number): number {
  return Math.max(0, Math.min(position ?? length, length));
}

export function createMemoryPlayQueue(): PlayQueueRepository {
  let order: PlayQueueEntry[] = [];
  let nextId = 1;
  const indexOf = (song: QueuedSong) =>
    order.findIndex((entry) => sameQueuedSong(queuedSongOf(entry), song));
  const entries = (): PlayQueueEntry[] =>
    order.map((entry, position) => ({ ...entry, position }));
  const place = (entry: PlayQueueEntry, position: number | undefined) => {
    order = order.filter((queued) => queued.id !== entry.id);
    order.splice(clampedIndex(position, order.length), 0, entry);
  };
  const entryOf = (song: QueuedSong): PlayQueueEntry => {
    const found = entries()[indexOf(song)];
    if (found === undefined) throw new Error('Play queue entry not found');
    return found;
  };
  return {
    list: () => Promise.resolve(entries()),
    add: (song, position) => {
      if (indexOf(song) < 0) {
        const keyed =
          song.kind === 'song'
            ? { songId: song.id, stemSetId: null }
            : { songId: null, stemSetId: song.id };
        place({ id: nextId, ...keyed, position: 0 }, position);
        nextId += 1;
      }
      return Promise.resolve(entryOf(song));
    },
    move: (song, position) => {
      const entry = order[indexOf(song)];
      if (entry !== undefined) place(entry, position);
      return Promise.resolve();
    },
    remove: (song) => {
      const at = indexOf(song);
      order = order.filter((_, index) => index !== at);
      return Promise.resolve();
    },
    takeThrough: (song) => {
      order = order.slice(indexOf(song) + 1);
      return Promise.resolve();
    },
    clear: () => {
      order = [];
      return Promise.resolve();
    },
  };
}
