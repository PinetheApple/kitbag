import { asc, eq } from 'drizzle-orm';

import {
  escapedLike,
  found,
  type Database,
  type DatabaseHandle,
  type Setlist,
  type SetlistItem,
} from './repository';
import { setlistItems, setlists } from './schema';

function clamp(position: number | undefined, length: number): number {
  return Math.max(0, Math.min(position ?? length, length));
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
  const items = await orderedItems(db, setlistId);
  const others = items.filter((entry) => entry.id !== item.id);
  const target = clamp(position, others.length);
  others.splice(target, 0, item);
  await renumber(db, setlistId, others);
  return { ...item, setlistId, position: target };
}

async function addItem(
  db: Database,
  setlistId: number,
  presetId: number,
  position: number | undefined,
): Promise<SetlistItem> {
  const item = found(
    await db
      .insert(setlistItems)
      .values({ setlistId, songPresetId: presetId, position: 0 })
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
      items.map(({ songPresetId }, position) => ({
        setlistId: copy.id,
        songPresetId,
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

async function deleteSetlist(db: Database, setlistId: number) {
  await db.delete(setlists).where(eq(setlists.id, setlistId));
}

async function removeItem(db: Database, itemId: number) {
  await db.delete(setlistItems).where(eq(setlistItems.id, itemId));
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
    delete: (setlistId: number) => serial(() => deleteSetlist(db, setlistId)),
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
      transaction(() => addItem(db, setlistId, presetId, position)),
    moveTo: (itemId: number, setlistId: number, position?: number) =>
      transaction(() => moveItem(db, itemId, setlistId, position)),
    move: (itemId: number, position: number) =>
      transaction(() => moveItem(db, itemId, undefined, position)),
    removeItem: (itemId: number) => serial(() => removeItem(db, itemId)),
  };
}

export function createSetlistRepository(handle: DatabaseHandle) {
  return { ...setlistCommands(handle), ...itemCommands(handle) };
}
