import { asc, eq } from 'drizzle-orm';

import { placeAt } from './ordering';
import { found, type Database, type DatabaseHandle } from './repository';
import { playQueue } from './schema';

export type PlayQueueEntry = typeof playQueue.$inferSelect;

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

async function queuedEntry(db: Database, stemSetId: number) {
  const [entry] = await db
    .select()
    .from(playQueue)
    .where(eq(playQueue.stemSetId, stemSetId));
  return entry;
}

async function addEntry(
  db: Database,
  stemSetId: number,
  position: number | undefined,
): Promise<PlayQueueEntry> {
  const existing = await queuedEntry(db, stemSetId);
  if (existing !== undefined) return existing;
  const entry = found(
    await db.insert(playQueue).values({ stemSetId, position: 0 }).returning(),
    'Play queue insert',
  );
  return place(db, entry, position);
}

async function moveEntry(db: Database, stemSetId: number, position: number) {
  const entry = await queuedEntry(db, stemSetId);
  if (entry !== undefined) await place(db, entry, position);
}

async function removeEntry(db: Database, stemSetId: number) {
  await db.delete(playQueue).where(eq(playQueue.stemSetId, stemSetId));
  await renumber(db, await orderedEntries(db));
}

export function createPlayQueueRepository({ db, transactor }: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    list: () => serial(() => orderedEntries(db)),
    add: (stemSetId: number, position?: number) =>
      transaction(() => addEntry(db, stemSetId, position)),
    move: (stemSetId: number, position: number) =>
      transaction(() => moveEntry(db, stemSetId, position)),
    remove: (stemSetId: number) =>
      transaction(() => removeEntry(db, stemSetId)),
    clear: () =>
      serial(async () => {
        await db.delete(playQueue);
      }),
  };
}

export type PlayQueueRepository = ReturnType<typeof createPlayQueueRepository>;
