import {
  ENTRY_KIND,
  libraryStore,
  metronomeStore,
  type LibrarySongRow,
  type LibraryStemSetRow,
  type PlayOrderRepositories,
  type QueuedSong,
} from '@kitbag/core-state';
import { vi } from 'vitest';

export const GIG = 5;
export const BALLAD_ITEM = 31;
export const BALLAD_PRESET = 41;
export const HUM = 23;

export const hum = {
  kind: 'song',
  id: HUM,
  title: 'Hum',
  artist: '',
  durationSec: 200,
  bpm: 90,
} as LibrarySongRow;

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

export function metronomeEntryOnStage() {
  const loadSong = vi.fn(() => Promise.resolve());
  libraryStore.setState({
    session: { setlistId: GIG, skipped: [] },
    setlists: [
      {
        setlist: { id: GIG, name: 'Gig', active: true },
        songCount: 1,
        rampCount: 0,
      },
    ] as never,
    entries: {
      [GIG]: [
        {
          kind: ENTRY_KIND.preset,
          item: { id: BALLAD_ITEM },
          preset: {
            id: BALLAD_PRESET,
            name: 'Ballad',
            bpm: 72,
            beatsPerBar: 4,
            denominator: 4,
          },
        },
      ] as never,
    },
    refresh: () => Promise.resolve(),
    loadSong,
  });
  const start = vi.spyOn(metronomeStore.getState(), 'start');
  return { loadSong, start };
}
