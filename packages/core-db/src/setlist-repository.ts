import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

import { placeAt } from './ordering';
import {
  escapedLike,
  found,
  rowExists,
  type Database,
  type DatabaseHandle,
  type Setlist,
  type SetlistItem,
} from './repository';
import {
  practiceSessions,
  setlistItems,
  setlists,
  songPresets,
  stemSets,
} from './schema';

export interface RemovedSetlistItem {
  readonly item: SetlistItem;
  readonly index: number;
}

export interface DeletedSetlist {
  readonly setlist: Setlist;
  readonly items: readonly SetlistItem[];
  readonly practiceSessionIds: readonly number[];
}

async function orderedItems(
  db: Database,
  setlistId: number,
): Promise<SetlistItem[]> {
  return db
    .select()
    .from(setlistItems)
    .where(eq(setlistItems.setlistId, setlistId))
    .orderBy(asc(setlistItems.position), asc(setlistItems.id));
}

async function renumber(
  db: Database,
  setlistId: number,
  items: readonly SetlistItem[],
): Promise<void> {
  for (const [position, item] of items.entries()) {
    if (item.setlistId === setlistId && item.position === position) continue;
    await db
      .update(setlistItems)
      .set({ setlistId, position })
      .where(eq(setlistItems.id, item.id));
  }
}

async function placeItem(
  db: Database,
  item: SetlistItem,
  setlistId: number,
  position: number | undefined,
): Promise<SetlistItem> {
  const placed = placeAt(await orderedItems(db, setlistId), item, position);
  await renumber(db, setlistId, placed.ordered);
  return { ...item, setlistId, position: placed.position };
}

type SetlistEntryRef =
  { readonly songPresetId: number } | { readonly stemSetId: number };

async function addItem(
  db: Database,
  setlistId: number,
  entry: SetlistEntryRef,
  position: number | undefined,
): Promise<SetlistItem> {
  const item = found(
    await db
      .insert(setlistItems)
      .values({ setlistId, ...entry, position: 0 })
      .returning(),
    'Setlist item insert',
  );
  return placeItem(db, item, setlistId, position);
}

async function moveItem(
  db: Database,
  itemId: number,
  destination: number | undefined,
  position: number | undefined,
): Promise<void> {
  const item = found(
    await db.select().from(setlistItems).where(eq(setlistItems.id, itemId)),
    `Setlist item ${String(itemId)}`,
  );
  const setlistId = destination ?? item.setlistId;
  if (item.setlistId !== setlistId) {
    const source = await orderedItems(db, item.setlistId);
    const remaining = source.filter((entry) => entry.id !== itemId);
    await renumber(db, item.setlistId, remaining);
  }
  await placeItem(db, item, setlistId, position);
}

async function setActive(db: Database, setlistId: number | null) {
  await db
    .update(setlists)
    .set({ active: false })
    .where(eq(setlists.active, true));
  if (setlistId === null) return;
  found(
    await db
      .update(setlists)
      .set({ active: true })
      .where(eq(setlists.id, setlistId))
      .returning({ id: setlists.id }),
    `Setlist ${String(setlistId)}`,
  );
}

async function insertSetlist(db: Database, name: string): Promise<Setlist> {
  return found(
    await db
      .insert(setlists)
      .values({ name, uuid: crypto.randomUUID() })
      .returning(),
    'Setlist insert',
  );
}

async function duplicateSetlist(
  db: Database,
  setlistId: number,
  name: string,
): Promise<Setlist> {
  found(
    await db.select().from(setlists).where(eq(setlists.id, setlistId)),
    `Setlist ${String(setlistId)}`,
  );
  const copy = await insertSetlist(db, name);
  const items = await orderedItems(db, setlistId);
  if (items.length > 0)
    await db.insert(setlistItems).values(
      items.map(({ songPresetId, stemSetId }, position) => ({
        setlistId: copy.id,
        songPresetId,
        stemSetId,
        position,
      })),
    );
  return copy;
}

async function activeSetlist(db: Database): Promise<Setlist | undefined> {
  const rows = await db
    .select()
    .from(setlists)
    .where(eq(setlists.active, true));
  return rows.at(0);
}

async function searchSetlists(db: Database, query: string) {
  return db
    .select()
    .from(setlists)
    .where(escapedLike(setlists.name, query))
    .orderBy(asc(setlists.id));
}

async function renameSetlist(db: Database, setlistId: number, name: string) {
  await db.update(setlists).set({ name }).where(eq(setlists.id, setlistId));
}

async function setlistById(db: Database, setlistId: number) {
  const [row] = await db
    .select()
    .from(setlists)
    .where(eq(setlists.id, setlistId));
  return row;
}

async function deleteSetlist(
  db: Database,
  setlistId: number,
): Promise<DeletedSetlist | undefined> {
  const setlist = await setlistById(db, setlistId);
  if (setlist === undefined) return undefined;
  const items = await orderedItems(db, setlistId);
  const sessions = await db
    .select({ id: practiceSessions.id })
    .from(practiceSessions)
    .where(eq(practiceSessions.setlistId, setlistId));
  await db.delete(setlists).where(eq(setlists.id, setlistId));
  return { setlist, items, practiceSessionIds: sessions.map(({ id }) => id) };
}

function entryExists(
  db: Database,
  { songPresetId, stemSetId }: SetlistItem,
): Promise<boolean> {
  return songPresetId === null
    ? rowExists(db, stemSets, stemSetId)
    : rowExists(db, songPresets, songPresetId);
}

async function restoreSetlist(db: Database, deleted: DeletedSetlist) {
  const { setlist, items, practiceSessionIds } = deleted;
  const active = setlist.active && (await activeSetlist(db)) === undefined;
  await db.insert(setlists).values({ ...setlist, active });
  let position = 0;
  for (const item of items) {
    if (!(await entryExists(db, item))) continue;
    await db.insert(setlistItems).values({ ...item, position });
    position += 1;
  }
  if (practiceSessionIds.length === 0) return;
  await db
    .update(practiceSessions)
    .set({ setlistId: setlist.id })
    .where(
      and(
        inArray(practiceSessions.id, [...practiceSessionIds]),
        isNull(practiceSessions.setlistId),
      ),
    );
}

export async function indexedItem(
  db: Database,
  item: SetlistItem,
): Promise<RemovedSetlistItem> {
  const ordered = await orderedItems(db, item.setlistId);
  return { item, index: ordered.findIndex((entry) => entry.id === item.id) };
}

async function removeItem(
  db: Database,
  itemId: number,
): Promise<RemovedSetlistItem | undefined> {
  const [item] = await db
    .select()
    .from(setlistItems)
    .where(eq(setlistItems.id, itemId));
  if (item === undefined) return undefined;
  const removed = await indexedItem(db, item);
  await db.delete(setlistItems).where(eq(setlistItems.id, itemId));
  return removed;
}

export async function restoreItem(
  db: Database,
  { item, index }: RemovedSetlistItem,
): Promise<boolean> {
  if (!(await rowExists(db, setlists, item.setlistId))) return false;
  if (!(await entryExists(db, item))) return false;
  const inserted = found(
    await db
      .insert(setlistItems)
      .values({ ...item, position: 0 })
      .returning(),
    'Setlist item restore',
  );
  await placeItem(db, inserted, item.setlistId, index);
  return true;
}

function setlistCommands({ db, transactor }: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    list: () =>
      serial(() => db.select().from(setlists).orderBy(asc(setlists.id))),
    active: () => serial(() => activeSetlist(db)),
    search: (query: string) => serial(() => searchSetlists(db, query)),
    create: (name: string) => serial(() => insertSetlist(db, name)),
    rename: (setlistId: number, name: string) =>
      serial(() => renameSetlist(db, setlistId, name)),
    delete: (setlistId: number) =>
      transaction(() => deleteSetlist(db, setlistId)),
    restore: (deleted: DeletedSetlist) =>
      transaction(() => restoreSetlist(db, deleted)),
    duplicate: (setlistId: number, name: string) =>
      transaction(() => duplicateSetlist(db, setlistId, name)),
    selectActive: (setlistId: number | null) =>
      transaction(() => setActive(db, setlistId)),
  };
}

function itemCommands({ db, transactor }: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    items: (setlistId: number) => serial(() => orderedItems(db, setlistId)),
    add: (setlistId: number, presetId: number, position?: number) =>
      transaction(() =>
        addItem(db, setlistId, { songPresetId: presetId }, position),
      ),
    addStemSet: (setlistId: number, stemSetId: number, position?: number) =>
      transaction(() => addItem(db, setlistId, { stemSetId }, position)),
    moveTo: (itemId: number, setlistId: number, position?: number) =>
      transaction(() => moveItem(db, itemId, setlistId, position)),
    move: (itemId: number, position: number) =>
      transaction(() => moveItem(db, itemId, undefined, position)),
    removeItem: (itemId: number) => transaction(() => removeItem(db, itemId)),
    restoreItem: (removed: RemovedSetlistItem) =>
      transaction(() => restoreItem(db, removed)),
  };
}

export function createSetlistRepository(handle: DatabaseHandle) {
  return { ...setlistCommands(handle), ...itemCommands(handle) };
}
