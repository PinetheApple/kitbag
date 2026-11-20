import { createPlayQueueRepository } from '@kitbag/core-db/src/play-queue-repository';
import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import {
  insertSong,
  insertStemSet,
} from '@kitbag/core-db/src/stem-entries.test-helper';
import type { QueuedSong } from '@kitbag/core-db';

import { queuedSongOf } from '@kitbag/core-db';

import { takeSnapshot } from '../library/snapshot.ts';
import { cursorOf } from './order.ts';
import { createPlayOrderStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

export const stems = (id: number): QueuedSong => ({ kind: 'stems', id });
export const song = (id: number): QueuedSong => ({ kind: 'song', id });

export function closeDatabases() {
  for (const { connection } of handles.splice(0)) connection.close();
}

export function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export function heldWrite() {
  const write = deferred();
  let standing = true;
  return {
    afterWrite: () => write.promise,
    stands: () => standing,
    press: () => {
      standing = false;
    },
    release: write.resolve,
  };
}

export async function setup(
  afterWrite: () => Promise<void> = () => Promise.resolve(),
) {
  const handle = openTestDatabase();
  handles.push(handle);
  const repository = createPlayQueueRepository(handle);
  const queue = {
    ...repository,
    takeThrough: async (song: QueuedSong) => {
      await repository.takeThrough(song);
      await afterWrite();
    },
  };
  const library = {
    setlists: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
  };
  const [a, b, c] = [
    await insertStemSet(handle.db, 'A'),
    await insertStemSet(handle.db, 'B'),
    await insertStemSet(handle.db, 'C'),
  ];
  const single = await insertSong(handle.db, 'Single');
  const warmUp = await library.presets.create({
    name: 'Warm-up',
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    accents: new Uint8Array([2, 1, 1, 1]),
    polyEnabled: false,
    polyBeats: 0,
    sound: 0,
  });
  const gig = await library.setlists.create('Gig');
  const first = await library.setlists.addStemSet(gig.id, a);
  const click = await library.setlists.add(gig.id, warmUp.id);
  const last = await library.setlists.addStemSet(gig.id, b);
  const setlist = async () => (await takeSnapshot(library)).entries[gig.id];
  let entries = (await setlist()) ?? [];
  const reload = async () => {
    entries = (await setlist()) ?? [];
  };
  let onStage: number | null = null;
  let moves = 0;
  const putOnStage = (itemId: number) => {
    onStage = itemId;
    moves++;
  };
  const stage = () => ({ setlistId: gig.id, entries, skipped: [] });
  const order = createPlayOrderStore({
    queue: () => queue,
    stage,
    cursor: () =>
      cursorOf(stage(), { presetId: 0, itemId: onStage, setlistId: gig.id }),
    refreshStage: reload,
    playSetlistEntry: (itemId) => {
      putOnStage(itemId);
      return afterWrite();
    },
    loadPreset: (_presetId, itemId) => {
      putOnStage(itemId);
      return afterWrite();
    },
    markStage: () => {
      const at = onStage;
      let written = moves;
      return {
        wrote: () => {
          written = moves;
        },
        restore: () => {
          if (moves === written) onStage = at;
        },
      };
    },
  });
  await order.getState().refresh();
  return {
    order,
    queue,
    library,
    handle,
    gig,
    a,
    b,
    c,
    single,
    first,
    click,
    last,
    reload,
    putOnStage,
  };
}

type Order = Awaited<ReturnType<typeof setup>>['order'];

export const queuedIds = (order: Order) =>
  order.getState().queue.map((entry) => entry.stemSetId);

export const queuedSongs = (order: Order) =>
  order.getState().queue.map(queuedSongOf);
