import type {
  LibraryStemSetRow,
  PlayOrderRepositories,
  QueuedSong,
} from '@kitbag/core-state';

export const stems = (id: number): QueuedSong => ({ kind: 'stems', id });
export const single = (id: number): QueuedSong => ({ kind: 'song', id });

export const queued: QueuedSong[] = [];

export function setQueued(songs: readonly QueuedSong[]): void {
  queued.splice(0, queued.length, ...songs);
}

const indexOf = (song: QueuedSong) =>
  queued.findIndex((entry) => entry.kind === song.kind && entry.id === song.id);

const entryOf = (song: QueuedSong, position: number) => ({
  id: position + 1,
  stemSetId: song.kind === 'stems' ? song.id : null,
  songId: song.kind === 'song' ? song.id : null,
  position,
});

export function fakeQueue(): PlayOrderRepositories['queue'] {
  const done = () => Promise.resolve();
  return {
    list: () => Promise.resolve(queued.map(entryOf)),
    add: (song, position) => {
      if (indexOf(song) < 0)
        queued.splice(position ?? queued.length, 0, { ...song });
      return Promise.resolve(entryOf(song, indexOf(song)));
    },
    move: (song, position) => {
      const at = indexOf(song);
      if (at >= 0) queued.splice(position, 0, ...queued.splice(at, 1));
      return done();
    },
    remove: (song) => {
      const at = indexOf(song);
      if (at >= 0) queued.splice(at, 1);
      return done();
    },
    takeThrough: (song) => {
      queued.splice(0, indexOf(song) + 1);
      return done();
    },
    clear: () => {
      queued.length = 0;
      return done();
    },
  };
}

export const stemRow = (id: number, title: string): LibraryStemSetRow => ({
  kind: 'stems',
  id,
  title,
  artist: null,
  stemCount: 4,
  durationSec: 200,
  bpm: 100,
  key: null,
  scale: null,
  hasGrid: true,
  createdAt: new Date(0),
});
