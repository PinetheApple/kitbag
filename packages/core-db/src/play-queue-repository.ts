import { asc, eq, inArray } from 'drizzle-orm';

import { placeAt } from './ordering';
import { found, type Database, type DatabaseHandle } from './repository';
import { playQueue } from './schema';
import type {
  LibrarySongRow,
  LibraryStemSetRow,
} from './song-library-repository';

export type PlayQueueEntry = typeof playQueue.$inferSelect;

export type QueuedSong =
  Pick<LibrarySongRow, 'kind' | 'id'> | Pick<LibraryStemSetRow, 'kind' | 'id'>;

export function queuedSongOf({
  songId,
  stemSetId,
}: Pick<PlayQueueEntry, 'songId' | 'stemSetId'>): QueuedSong {
  if (songId !== null) return { kind: 'song', id: songId };
  if (stemSetId !== null) return { kind: 'stems', id: stemSetId };
  throw new Error('Play queue entry holds no song');
}

export function sameQueuedSong(a: QueuedSong, b: QueuedSong): boolean {
  return a.kind === b.kind && a.id === b.id;
}

const holds = (song: QueuedSong) => (entry: PlayQueueEntry) =>
  sameQueuedSong(queuedSongOf(entry), song);

const keyOf = (song: QueuedSong) =>
  song.kind === 'song'
    ? eq(playQueue.songId, song.id)
    : eq(playQueue.stemSetId, song.id);

export const queueColumnsOf = (song: QueuedSong) =>
  song.kind === 'song'
    ? { songId: song.id, stemSetId: null }
    : { songId: null, stemSetId: song.id };

async function orderedEntries(db: Database): Promise<PlayQueueEntry[]> {
  return db
    .select()
    .from(playQueue)
    .orderBy(asc(playQueue.position), asc(playQueue.id));
}

async function renumber(db: Database, entries: readonly PlayQueueEntry[]) {
  for (const [position, entry] of entries.entries()) {
    if (entry.position === position) continue;
    await db
      .update(playQueue)
      .set({ position })
      .where(eq(playQueue.id, entry.id));
  }
}

async function place(
  db: Database,
  entry: PlayQueueEntry,
  position: number | undefined,
): Promise<PlayQueueEntry> {
  const placed = placeAt(await orderedEntries(db), entry, position);
  await renumber(db, placed.ordered);
  return { ...entry, position: placed.position };
}

async function queuedEntry(db: Database, song: QueuedSong) {
  const [entry] = await db.select().from(playQueue).where(keyOf(song));
  return entry;
}

async function addEntry(
  db: Database,
  song: QueuedSong,
  position: number | undefined,
): Promise<PlayQueueEntry> {
  const existing = await queuedEntry(db, song);
  if (existing !== undefined) return existing;
  const entry = found(
    await db
      .insert(playQueue)
      .values({ ...queueColumnsOf(song), position: 0 })
      .returning(),
    'Play queue insert',
  );
  return place(db, entry, position);
}

async function moveEntry(db: Database, song: QueuedSong, position: number) {
  const entry = await queuedEntry(db, song);
  if (entry !== undefined) await place(db, entry, position);
}

async function removeEntry(db: Database, song: QueuedSong) {
  await db.delete(playQueue).where(keyOf(song));
  await renumber(db, await orderedEntries(db));
}

async function takeThroughEntry(db: Database, song: QueuedSong) {
  const entries = await orderedEntries(db);
  const through = entries.findIndex(holds(song));
  if (through < 0) return;
  const taken = entries.slice(0, through + 1).map((entry) => entry.id);
  await db.delete(playQueue).where(inArray(playQueue.id, taken));
  await renumber(db, entries.slice(through + 1));
}

export function createPlayQueueRepository({ db, transactor }: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    list: () => serial(() => orderedEntries(db)),
    add: (song: QueuedSong, position?: number) =>
      transaction(() => addEntry(db, song, position)),
    move: (song: QueuedSong, position: number) =>
      transaction(() => moveEntry(db, song, position)),
    remove: (song: QueuedSong) => transaction(() => removeEntry(db, song)),
    takeThrough: (song: QueuedSong) =>
      transaction(() => takeThroughEntry(db, song)),
    clear: () =>
      serial(async () => {
        await db.delete(playQueue);
      }),
  };
}

export type PlayQueueRepository = ReturnType<typeof createPlayQueueRepository>;
