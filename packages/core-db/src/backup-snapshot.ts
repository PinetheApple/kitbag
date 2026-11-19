import { asc, inArray, sql } from 'drizzle-orm';

import {
  MS_PER_SECOND,
  PREFERENCE_KEYS,
  type Category,
  type LibrarySongRecord,
  type LocalRecords,
  type PracticeSessionRecord,
  type PreferenceCategory,
  type SetlistRecord,
  type SongPresetRecord,
} from './backup-format';
import { encodeBase64, nullableBase64, presetBase64 } from './base64';
import { meterOverrideOf } from './meter-override';
import type { Database } from './repository';
import { storedTempoCorrection, tempoCorrectionOf } from './tempo-correction';
import {
  clickSounds,
  practiceSessions,
  preferences,
  setlistItems,
  setlists,
  songPresets,
  songs,
  tunings,
} from './schema';

export type IdMaps = Record<Category, Map<string, number>>;

export interface Snapshot {
  records: LocalRecords;
  ids: IdMaps;
}

export const toSeconds = (date: Date) =>
  Math.floor(date.getTime() / MS_PER_SECOND);
export const fromSeconds = (seconds: number) =>
  new Date(seconds * MS_PER_SECOND);

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

// Status and error describe this device's copy of the file.
const UNPORTABLE_SONG_FIELDS = [
  'id',
  'analysisStatus',
  'analysisError',
] as const;
const unportable = new Set<string>(UNPORTABLE_SONG_FIELDS);

function portableSong(row: SongRow) {
  return Object.fromEntries(
    Object.entries(row).filter(([field]) => !unportable.has(field)),
  ) as Omit<SongRow, (typeof UNPORTABLE_SONG_FIELDS)[number]>;
}

function librarySongRecord(row: SongRow): LibrarySongRecord {
  return {
    ...portableSong(row),
    ...meterOverrideOf(row),
    tempoCorrection: storedTempoCorrection(
      tempoCorrectionOf(row.tempoCorrection),
    ),
    createdAt: toSeconds(row.createdAt),
    beatGrid: nullableBase64(row.beatGrid),
    downbeatIndices: nullableBase64(row.downbeatIndices),
  };
}

function songPresetRecord(
  row: PresetRow,
  songUuid: (id: number | null) => string | null,
): SongPresetRecord {
  const { librarySongId, ...rest } = withoutId(row);
  return {
    ...rest,
    ...presetBase64(row),
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

function loadPreferences(db: Database, category: PreferenceCategory) {
  return db
    .select({
      id: sql<number>`rowid`,
      key: preferences.key,
      value: preferences.value,
    })
    .from(preferences)
    .where(inArray(preferences.key, [...PREFERENCE_KEYS[category]]))
    .orderBy(asc(preferences.key));
}

const preferenceRecords = (rows: { key: string; value: string }[]) =>
  rows.map(({ key, value }) => ({ key, value }));

const preferenceIds = (rows: { id: number; key: string }[]) =>
  new Map(rows.map((row) => [row.key, row.id]));

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
    countInRows: await loadPreferences(db, 'countInSettings'),
    metronomeRows: await loadPreferences(db, 'metronomeSettings'),
    clickSoundRows: await db
      .select()
      .from(clickSounds)
      .orderBy(asc(clickSounds.slot)),
  };
}

export async function loadSnapshot(db: Database): Promise<Snapshot> {
  const rows = await loadRows(db);
  const songUuid = uuidOf(rows.songRows);
  const records: LocalRecords = {
    librarySongs: rows.songRows.map(librarySongRecord),
    songPresets: rows.presetRows.map((row) => songPresetRecord(row, songUuid)),
    setlists: await loadSetlists(db, rows.setlistRows, uuidOf(rows.presetRows)),
    tunings: rows.tuningRows.map(({ uuid, name, notes, instrument }) => ({
      uuid,
      name,
      notes: encodeBase64(notes),
      instrument,
    })),
    practiceSessions: rows.practiceRows.map((row) =>
      practiceRecord(row, uuidOf(rows.setlistRows)),
    ),
    countInSettings: preferenceRecords(rows.countInRows),
    metronomeSettings: preferenceRecords(rows.metronomeRows),
    clickSounds: rows.clickSoundRows,
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
    countInSettings: preferenceIds(rows.countInRows),
    metronomeSettings: preferenceIds(rows.metronomeRows),
    clickSounds: new Map(
      rows.clickSoundRows.map(({ slot }) => [String(slot), slot]),
    ),
  };
}
