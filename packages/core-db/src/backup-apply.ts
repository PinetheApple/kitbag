import { eq, isNotNull } from 'drizzle-orm';

import {
  recordKey,
  type BackupRecord,
  type Category,
  type LibrarySongRecord,
  type PracticeSessionRecord,
  type SetlistRecord,
  type SongPresetRecord,
  type TuningRecord,
} from './backup-format';
import type { ImportPlan, Writes } from './backup-plan';
import {
  decodeBase64,
  fromSeconds,
  type IdMaps,
  type Snapshot,
} from './backup-snapshot';
import { found, type Database } from './repository';
import {
  practiceSessions,
  setlistItems,
  setlists,
  songPresets,
  songs,
  tunings,
} from './schema';

const nullableBytes = (encoded: string | null) =>
  encoded === null ? null : decodeBase64(encoded);

const lookup = (map: Map<string, number>, uuid: string | null) =>
  uuid === null ? null : (map.get(uuid) ?? null);

function librarySongValues(record: LibrarySongRecord) {
  return {
    ...record,
    createdAt: fromSeconds(record.createdAt),
    beatGrid: nullableBytes(record.beatGrid),
    downbeatIndices: nullableBytes(record.downbeatIndices),
  };
}

function songPresetValues(record: SongPresetRecord, ids: IdMaps) {
  const { librarySongUuid, ...rest } = record;
  return {
    ...rest,
    accents: decodeBase64(record.accents),
    perAccentSounds: nullableBytes(record.perAccentSounds),
    polyAccents: nullableBytes(record.polyAccents),
    librarySongId: lookup(ids.librarySongs, librarySongUuid),
  };
}

function practiceValues(record: PracticeSessionRecord, ids: IdMaps) {
  return {
    startTime: fromSeconds(record.startTime),
    durationSeconds: record.durationSeconds,
    avgBpm: record.avgBpm,
    setlistId: lookup(ids.setlists, record.setlistUuid),
    songsPlayed: record.songsPlayed,
  };
}

async function writeItems(
  db: Database,
  setlistId: number,
  record: SetlistRecord,
  ids: IdMaps,
) {
  await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  const rows = record.presetUuids.map((uuid, position) => {
    const songPresetId = ids.songPresets.get(uuid);
    if (songPresetId === undefined)
      throw new Error(`Song preset ${uuid} missing`);
    return { setlistId, songPresetId, position };
  });
  if (rows.length > 0) await db.insert(setlistItems).values(rows);
}

async function upsertSetlist(
  db: Database,
  record: SetlistRecord,
  localId: number | undefined,
  context: WriteContext,
): Promise<number> {
  const { uuid, name } = record;
  const active = context.mode === 'replace' && record.active;
  if (localId !== undefined)
    await db.update(setlists).set({ name }).where(eq(setlists.id, localId));
  const id =
    localId ??
    found(
      await db
        .insert(setlists)
        .values({ uuid, name, active })
        .returning({ id: setlists.id }),
      'Setlist insert',
    ).id;
  await writeItems(db, id, record, context.ids);
  return id;
}

interface WriteContext {
  mode: ImportPlan['mode'];
  ids: IdMaps;
}

type Upsert = (
  db: Database,
  record: BackupRecord,
  localId: number | undefined,
  context: WriteContext,
) => Promise<number>;

function simpleUpsert(
  table:
    | typeof songs
    | typeof songPresets
    | typeof tunings
    | typeof practiceSessions,
  values: (record: never, ids: IdMaps) => Record<string, unknown>,
): Upsert {
  return async (db, record, localId, { ids }) => {
    const row = values(record as never, ids);
    if (localId !== undefined) {
      await db.update(table).set(row).where(eq(table.id, localId));
      return localId;
    }
    const inserted = await db
      .insert(table)
      .values(row as never)
      .returning({
        id: table.id,
      });
    return found(inserted, 'Backup insert').id;
  };
}

const UPSERTS: Record<Category, Upsert> = {
  librarySongs: simpleUpsert(songs, librarySongValues),
  songPresets: simpleUpsert(songPresets, songPresetValues),
  setlists: upsertSetlist as Upsert,
  tunings: simpleUpsert(tunings, (record: TuningRecord) => ({
    ...record,
    notes: decodeBase64(record.notes),
  })),
  practiceSessions: simpleUpsert(practiceSessions, practiceValues),
};

async function deleteCategory(db: Database, category: Category) {
  if (category === 'setlists') {
    await db.delete(setlistItems);
    await db.update(practiceSessions).set({ setlistId: null });
    await db.delete(setlists);
  } else if (category === 'songPresets') {
    await db.delete(setlistItems);
    await db.delete(songPresets);
  } else if (category === 'librarySongs') {
    await db
      .update(songPresets)
      .set({ librarySongId: null })
      .where(isNotNull(songPresets.librarySongId));
    await db.delete(songs);
  } else if (category === 'tunings') await db.delete(tunings);
  else await db.delete(practiceSessions);
}

async function adoptActiveSetlist(db: Database, plan: ImportPlan, ids: IdMaps) {
  const incoming = plan.file.records.setlists.find((record) => record.active);
  if (plan.mode !== 'merge' || incoming === undefined) return;
  const current = await db
    .select({ id: setlists.id })
    .from(setlists)
    .where(eq(setlists.active, true));
  const id = ids.setlists.get(incoming.uuid);
  if (current.length > 0 || id === undefined) return;
  await db.update(setlists).set({ active: true }).where(eq(setlists.id, id));
}

async function relinkUntouched(
  db: Database,
  plan: ImportPlan,
  snapshot: Snapshot,
) {
  const { ids, records } = snapshot;
  const replaced = (category: Category) => plan.categories.includes(category);
  if (replaced('setlists') && !replaced('practiceSessions'))
    for (const session of records.practiceSessions) {
      const id = ids.practiceSessions.get(recordKey(session));
      if (id === undefined || session.setlistUuid === null) continue;
      await db
        .update(practiceSessions)
        .set({ setlistId: lookup(ids.setlists, session.setlistUuid) })
        .where(eq(practiceSessions.id, id));
    }
  if (replaced('librarySongs') && !replaced('songPresets'))
    for (const preset of records.songPresets) {
      const id = ids.songPresets.get(preset.uuid);
      if (id === undefined || preset.librarySongUuid === null) continue;
      await db
        .update(songPresets)
        .set({
          librarySongId: lookup(ids.librarySongs, preset.librarySongUuid),
        })
        .where(eq(songPresets.id, id));
    }
}

async function upsertAll(
  db: Database,
  plan: ImportPlan,
  writes: Writes,
  ids: IdMaps,
) {
  for (const category of plan.categories)
    for (const { record, localId } of writes[category] ?? []) {
      const id = await UPSERTS[category](db, record, localId, {
        mode: plan.mode,
        ids,
      });
      ids[category].set(recordKey(record), id);
    }
}

export async function applyWrites(
  db: Database,
  plan: ImportPlan,
  writes: Writes,
  snapshot: Snapshot,
) {
  const { ids } = snapshot;
  if (plan.mode === 'replace')
    for (const category of [...plan.categories].reverse()) {
      await deleteCategory(db, category);
      ids[category].clear();
    }
  await upsertAll(db, plan, writes, ids);
  if (plan.mode === 'replace') await relinkUntouched(db, plan, snapshot);
  if (plan.categories.includes('setlists'))
    await adoptActiveSetlist(db, plan, ids);
}
