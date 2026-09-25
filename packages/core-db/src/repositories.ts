import { asc, eq, like, or, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import * as schema from './schema';

export type Database = BaseSQLiteDatabase<'async', unknown, typeof schema>;
export type Setlist = typeof schema.setlists.$inferSelect;
export type SetlistItem = typeof schema.setlistItems.$inferSelect;
export type SongPreset = typeof schema.songPresets.$inferSelect;
function required<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`${label} returned no row`);
  return value;
}
export type NewSongPreset = typeof schema.songPresets.$inferInsert;

function uuid(): string {
  return crypto.randomUUID();
}

function searchPattern(query: string): string {
  return `%${query.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

const escapedLike = (column: Parameters<typeof like>[0], query: string) =>
  sql`${column} LIKE ${searchPattern(query)} ESCAPE '\\'`;

export function createSetlistRepository(db: Database) {
  return {
    async list(): Promise<Setlist[]> {
      return db.select().from(schema.setlists).orderBy(asc(schema.setlists.id));
    },
    async active(): Promise<Setlist | undefined> {
      return (
        await db
          .select()
          .from(schema.setlists)
          .where(eq(schema.setlists.active, true))
      )[0];
    },
    async selectActive(id: number | null): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.update(schema.setlists).set({ active: false });
        if (id !== null)
          await tx
            .update(schema.setlists)
            .set({ active: true })
            .where(eq(schema.setlists.id, id));
      });
    },
    async search(query: string): Promise<Setlist[]> {
      return db
        .select()
        .from(schema.setlists)
        .where(escapedLike(schema.setlists.name, query))
        .orderBy(asc(schema.setlists.id));
    },
    async create(name: string): Promise<Setlist> {
      const [row] = await db
        .insert(schema.setlists)
        .values({ name, uuid: uuid() })
        .returning();
      return required(row, 'Setlist insert');
    },
    async rename(id: number, name: string): Promise<void> {
      await db
        .update(schema.setlists)
        .set({ name })
        .where(eq(schema.setlists.id, id));
    },
    async remove(id: number): Promise<void> {
      await db.delete(schema.setlists).where(eq(schema.setlists.id, id));
    },
    async duplicate(id: number, name?: string): Promise<Setlist> {
      return db.transaction(async (tx) => {
        const [source] = await tx
          .select()
          .from(schema.setlists)
          .where(eq(schema.setlists.id, id));
        if (!source) throw new Error(`Setlist ${String(id)} not found`);
        const [copy] = await tx
          .insert(schema.setlists)
          .values({ name: name ?? `${source.name} Copy`, uuid: uuid() })
          .returning();
        const items = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.setlistId, id));
        if (items.length)
          await tx.insert(schema.setlistItems).values(
            items.map(({ songPresetId, position }) => ({
              setlistId: required(copy, 'Setlist insert').id,
              songPresetId,
              position,
            })),
          );
        return required(copy, 'Setlist insert');
      });
    },
    async items(id: number): Promise<SetlistItem[]> {
      return db
        .select()
        .from(schema.setlistItems)
        .where(eq(schema.setlistItems.setlistId, id))
        .orderBy(
          asc(schema.setlistItems.position),
          asc(schema.setlistItems.id),
        );
    },
    async add(
      id: number,
      songPresetId: number,
      position?: number,
    ): Promise<SetlistItem> {
      return db.transaction(async (tx) => {
        const items = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.setlistId, id))
          .orderBy(
            asc(schema.setlistItems.position),
            asc(schema.setlistItems.id),
          );
        const target = Math.max(
          0,
          Math.min(position ?? items.length, items.length),
        );
        for (let index = items.length - 1; index >= target; index--)
          await tx
            .update(schema.setlistItems)
            .set({ position: index + 1 })
            .where(
              eq(
                schema.setlistItems.id,
                required(items[index], 'Setlist item').id,
              ),
            );
        const [row] = await tx
          .insert(schema.setlistItems)
          .values({ setlistId: id, songPresetId, position: target })
          .returning();
        return required(row, 'Setlist item insert');
      });
    },
    async move(itemId: number, position: number): Promise<void> {
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.id, itemId));
        if (!item) throw new Error(`Setlist item ${String(itemId)} not found`);
        const items = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.setlistId, item.setlistId))
          .orderBy(
            asc(schema.setlistItems.position),
            asc(schema.setlistItems.id),
          );
        const without = items.filter((entry) => entry.id !== itemId);
        without.splice(
          Math.max(0, Math.min(position, without.length)),
          0,
          item,
        );
        for (let index = 0; index < without.length; index++)
          await tx
            .update(schema.setlistItems)
            .set({ position: index })
            .where(
              eq(
                schema.setlistItems.id,
                required(without[index], 'Setlist item').id,
              ),
            );
      });
    },
    async moveTo(
      itemId: number,
      setlistId: number,
      position?: number,
    ): Promise<void> {
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.id, itemId));
        if (!item) throw new Error(`Setlist item ${String(itemId)} not found`);
        const source = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.setlistId, item.setlistId))
          .orderBy(
            asc(schema.setlistItems.position),
            asc(schema.setlistItems.id),
          );
        const target = await tx
          .select()
          .from(schema.setlistItems)
          .where(eq(schema.setlistItems.setlistId, setlistId))
          .orderBy(
            asc(schema.setlistItems.position),
            asc(schema.setlistItems.id),
          );
        const remaining = source.filter((entry) => entry.id !== itemId);
        const insertion = Math.max(
          0,
          Math.min(position ?? target.length, target.length),
        );
        if (item.setlistId === setlistId)
          target.splice(
            target.findIndex((entry) => entry.id === itemId),
            1,
          );
        target.splice(insertion, 0, item);
        for (let index = 0; index < remaining.length; index++)
          await tx
            .update(schema.setlistItems)
            .set({ position: index })
            .where(
              eq(
                schema.setlistItems.id,
                required(remaining[index], 'Setlist item').id,
              ),
            );
        for (let index = 0; index < target.length; index++)
          await tx
            .update(schema.setlistItems)
            .set({ setlistId, position: index })
            .where(
              eq(
                schema.setlistItems.id,
                required(target[index], 'Setlist item').id,
              ),
            );
      });
    },
    async removeItem(itemId: number): Promise<void> {
      await db
        .delete(schema.setlistItems)
        .where(eq(schema.setlistItems.id, itemId));
    },
  };
}

export function createSongPresetRepository(db: Database) {
  return {
    async get(id: number): Promise<SongPreset | undefined> {
      return (
        await db
          .select()
          .from(schema.songPresets)
          .where(eq(schema.songPresets.id, id))
      )[0];
    },
    async list(): Promise<SongPreset[]> {
      return db
        .select()
        .from(schema.songPresets)
        .orderBy(asc(schema.songPresets.id));
    },
    async search(query: string): Promise<SongPreset[]> {
      const term = or(
        escapedLike(schema.songPresets.name, query),
        escapedLike(schema.songPresets.title, query),
        escapedLike(schema.songPresets.artist, query),
      );
      return db
        .select()
        .from(schema.songPresets)
        .where(term)
        .orderBy(asc(schema.songPresets.id));
    },
    async create(values: Omit<NewSongPreset, 'uuid'>): Promise<SongPreset> {
      const [row] = await db
        .insert(schema.songPresets)
        .values({ ...values, uuid: uuid() })
        .returning();
      return required(row, 'Preset insert');
    },
    async update(
      id: number,
      values: Partial<Omit<NewSongPreset, 'id' | 'uuid'>>,
    ): Promise<void> {
      await db
        .update(schema.songPresets)
        .set(values)
        .where(eq(schema.songPresets.id, id));
    },
    async duplicate(id: number, name?: string): Promise<SongPreset> {
      const [source] = await db
        .select()
        .from(schema.songPresets)
        .where(eq(schema.songPresets.id, id));
      if (!source) throw new Error(`Song preset ${String(id)} not found`);
      const { id: _id, uuid: _uuid, name: sourceName, ...values } = source;
      void _id;
      void _uuid;
      const [row] = await db
        .insert(schema.songPresets)
        .values({ ...values, name: name ?? `${sourceName} Copy`, uuid: uuid() })
        .returning();
      return required(row, 'Preset insert');
    },
    async delete(id: number): Promise<void> {
      await db.delete(schema.songPresets).where(eq(schema.songPresets.id, id));
    },
  };
}
