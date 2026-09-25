import { asc } from 'drizzle-orm';

import {
  MS_PER_SECOND,
  type Category,
  type CategoryRecords,
  type LibrarySongRecord,
  type PracticeSessionRecord,
  type SetlistRecord,
  type SongPresetRecord,
} from './backup-format';
import type { Database } from './repository';
import {
  practiceSessions,
  setlistItems,
  setlists,
  songPresets,
  songs,
  tunings,
} from './schema';

const BYTE_CHUNK = 0x8000;

export type IdMaps = Record<Category, Map<string, number>>;

export interface Snapshot {
  records: CategoryRecords;
  ids: IdMaps;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let start = 0; start < bytes.length; start += BYTE_CHUNK)
    binary += String.fromCharCode(...bytes.subarray(start, start + BYTE_CHUNK));
  return btoa(binary);
}

export function decodeBase64(encoded: string): Buffer {
  return Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)) as Buffer;
}

export const toSeconds = (date: Date) =>
  Math.floor(date.getTime() / MS_PER_SECOND);
export const fromSeconds = (seconds: number) =>
  new Date(seconds * MS_PER_SECOND);

const nullableBase64 = (bytes: Uint8Array | null) =>
  bytes === null ? null : encodeBase64(bytes);

function uuidOf(rows: { id: number; uuid: string }[]) {
  const map = new Map(rows.map((row) => [row.id, row.uuid]));
  return (id: number | null) => (id === null ? null : (map.get(id) ?? null));
}

type SongRow = typeof songs.$inferSelect;
type PresetRow = typeof songPresets.$inferSelect;

function withoutId<T extends { id: number }>(row: T): Omit<T, 'id'> {
  const copy: Partial<T> = { ...row };
  delete copy.id;
  return copy as Omit<T, 'id'>;
}

function librarySongRecord(row: SongRow): LibrarySongRecord {
  const { createdAt, beatGrid, downbeatIndices } = row;
  return {
    ...withoutId(row),
    createdAt: toSeconds(createdAt),
    beatGrid: nullableBase64(beatGrid),
    downbeatIndices: nullableBase64(downbeatIndices),
  };
}

function songPresetRecord(
  row: PresetRow,
  songUuid: (id: number | null) => string | null,
): SongPresetRecord {
  const { librarySongId, ...rest } = withoutId(row);
  return {
    ...rest,
    accents: encodeBase64(row.accents),
    perAccentSounds: nullableBase64(row.perAccentSounds),
    polyAccents: nullableBase64(row.polyAccents),
    librarySongUuid: songUuid(librarySongId),
  };
}

async function loadSetlists(
  db: Database,
  rows: (typeof setlists.$inferSelect)[],
  presetUuid: (id: number | null) => string | null,
): Promise<SetlistRecord[]> {
  const items = await db
    .select()
    .from(setlistItems)
    .orderBy(asc(setlistItems.position), asc(setlistItems.id));
  return rows.map(({ uuid, name, active, id }) => ({
    uuid,
    name,
    active,
    presetUuids: items
      .filter((item) => item.setlistId === id)
      .map((item) => presetUuid(item.songPresetId) ?? ''),
  }));
}

function practiceRecord(
  row: typeof practiceSessions.$inferSelect,
  setlistUuid: (id: number | null) => string | null,
): PracticeSessionRecord {
  return {
    uuid: row.uuid,
    startTime: toSeconds(row.startTime),
    durationSeconds: row.durationSeconds,
    avgBpm: row.avgBpm,
    setlistUuid: setlistUuid(row.setlistId),
    songsPlayed: row.songsPlayed,
  };
}

async function loadRows(db: Database) {
  return {
    songRows: await db.select().from(songs).orderBy(asc(songs.id)),
    presetRows: await db
      .select()
      .from(songPresets)
      .orderBy(asc(songPresets.id)),
    setlistRows: await db.select().from(setlists).orderBy(asc(setlists.id)),
    tuningRows: await db.select().from(tunings).orderBy(asc(tunings.id)),
    practiceRows: await db
      .select()
      .from(practiceSessions)
      .orderBy(asc(practiceSessions.id)),
  };
}

export async function loadSnapshot(db: Database): Promise<Snapshot> {
  const rows = await loadRows(db);
  const songUuid = uuidOf(rows.songRows);
  const records: CategoryRecords = {
    librarySongs: rows.songRows.map(librarySongRecord),
    songPresets: rows.presetRows.map((row) => songPresetRecord(row, songUuid)),
    setlists: await loadSetlists(db, rows.setlistRows, uuidOf(rows.presetRows)),
    tunings: rows.tuningRows.map(({ uuid, name, notes }) => ({
      uuid,
      name,
      notes: encodeBase64(notes),
    })),
    practiceSessions: rows.practiceRows.map((row) =>
      practiceRecord(row, uuidOf(rows.setlistRows)),
    ),
  };
  return { records, ids: idMaps(rows) };
}

function idMaps(rows: Awaited<ReturnType<typeof loadRows>>): IdMaps {
  const byUuid = (list: { id: number; uuid: string }[]) =>
    new Map(list.map((row) => [row.uuid, row.id]));
  return {
    librarySongs: byUuid(rows.songRows),
    songPresets: byUuid(rows.presetRows),
    setlists: byUuid(rows.setlistRows),
    tunings: byUuid(rows.tuningRows),
    practiceSessions: byUuid(rows.practiceRows),
  };
}
