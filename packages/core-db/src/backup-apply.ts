import { eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { ANALYSIS_STATUS } from './analysis-status';
import {
  isPreferenceCategory,
  PREFERENCE_KEYS,
  recordKey,
  referenceOf,
  REFERENCES,
  type BackupRecord,
  type Category,
  type ClickSoundRecord,
  type LibrarySongRecord,
  type PracticeSessionRecord,
  type PreferenceRecord,
  type SetlistRecord,
  type SongPresetRecord,
  type StemSongRecord,
  type TuningRecord,
} from './backup-format';
import type { ImportPlan, Writes } from './backup-plan';
import { decodeBase64, nullableBytes, presetBytes } from './base64';
import { fromSeconds, type IdMaps, type Snapshot } from './backup-snapshot';
import {
  entryRefs,
  loadStemEntries,
  type SetlistEntryContext,
} from './backup-setlist-entries';
import { restoreStemSong } from './backup-stem-songs';
import {
  freshClickSoundFileName,
  type ClickSoundFiles,
} from './click-sound-files';
import { resetStaleSounds } from './click-sound-references';
import { clickSoundIn, putClickSound } from './click-sound-repository';
import { CUSTOM_SOUND_SLOTS } from './preset-rules';
import { found, type Database } from './repository';
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

const lookup = (map: Map<string, number>, uuid: string | null) =>
  uuid === null ? null : (map.get(uuid) ?? null);

function librarySongValues(record: LibrarySongRecord) {
  return {
    ...record,
    analysisStatus:
      record.beatGrid === null ? ANALYSIS_STATUS.pending : ANALYSIS_STATUS.done,
    createdAt: fromSeconds(record.createdAt),
    beatGrid: nullableBytes(record.beatGrid),
    downbeatIndices: nullableBytes(record.downbeatIndices),
    analysisVersion: record.analysisVersion ?? null,
  };
}

function songPresetValues(record: SongPresetRecord, ids: IdMaps) {
  const { librarySongUuid, ...rest } = record;
  return {
    ...rest,
    ...presetBytes(record),
    librarySongId: lookup(ids.librarySongs, librarySongUuid),
  };
}

function practiceValues(record: PracticeSessionRecord, ids: IdMaps) {
  return {
    uuid: record.uuid,
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
  context: WriteContext,
) {
  await db.delete(setlistItems).where(eq(setlistItems.setlistId, setlistId));
  const rows = entryRefs(record, context).map((ref, position) => ({
    setlistId,
    position,
    songPresetId: null,
    stemSetId: null,
    ...ref,
  }));
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
  await writeItems(db, id, record, context);
  return id;
}

export interface ClickSoundFileLog {
  written: string[];
  replaced: string[];
}

export interface FileContext {
  files: ClickSoundFiles;
  log: ClickSoundFileLog;
}

interface WriteContext extends FileContext, SetlistEntryContext {
  mode: ImportPlan['mode'];
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

async function upsertPreference(
  db: Database,
  record: PreferenceRecord,
): Promise<number> {
  const { key, value } = record;
  const rows = await db
    .insert(preferences)
    .values({ key, value })
    .onConflictDoUpdate({ target: preferences.key, set: { value } })
    .returning({ id: sql<number>`rowid` });
  return found(rows, 'Preference upsert').id;
}

async function upsertClickSound(
  db: Database,
  record: ClickSoundRecord,
  _localId: number | undefined,
  { files, log }: WriteContext,
): Promise<number> {
  const { wav, ...sound } = record;
  const fileName = freshClickSoundFileName();
  log.written.push(fileName);
  await files.write(fileName, wav);
  const previous = await clickSoundIn(db, sound.slot);
  if (previous !== null) log.replaced.push(previous.fileName);
  await putClickSound(db, { ...sound, fileName });
  return sound.slot;
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
  countInSettings: upsertPreference as Upsert,
  metronomeSettings: upsertPreference as Upsert,
  clickSounds: upsertClickSound as Upsert,
  stemSongs: (db, record, localId) =>
    restoreStemSong(db, record as StemSongRecord, localId),
};

async function deleteCategory(db: Database, category: Category) {
  if (category === 'stemSongs') return;
  if (isPreferenceCategory(category)) {
    await db
      .delete(preferences)
      .where(inArray(preferences.key, [...PREFERENCE_KEYS[category]]));
  } else if (category === 'setlists') {
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
  } else if (category === 'tunings') {
    await db.delete(tunings);
  } else if (category === 'clickSounds') {
    await db.delete(clickSounds);
  } else {
    await db.delete(practiceSessions);
  }
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

const REFERENCE_TABLES = { songPresets, practiceSessions } as const;

async function relinkUntouched(
  db: Database,
  plan: ImportPlan,
  snapshot: Snapshot,
) {
  const { ids, records } = snapshot;
  const replaced = (category: Category) => plan.categories.includes(category);
  for (const reference of REFERENCES) {
    const { source, target, localColumn } = reference;
    if (!replaced(target) || replaced(source)) continue;
    const table = REFERENCE_TABLES[source];
    for (const record of records[source]) {
      const id = ids[source].get(recordKey(source, record));
      const uuid = referenceOf(record, reference);
      if (id === undefined || uuid === null) continue;
      await db
        .update(table)
        .set({ [localColumn]: lookup(ids[target], uuid) })
        .where(eq(table.id, id));
    }
  }
}

async function upsertAll(
  db: Database,
  plan: ImportPlan,
  writes: Writes,
  context: Omit<WriteContext, 'mode'>,
) {
  const { ids } = context;
  for (const category of plan.categories)
    for (const { record, localId } of writes[category] ?? []) {
      const id = await UPSERTS[category](db, record, localId, {
        ...context,
        mode: plan.mode,
      });
      ids[category].set(recordKey(category, record), id);
    }
}

const slotSounds = (sounds: readonly { slot: number; uuid: string }[]) =>
  new Map(sounds.map(({ slot, uuid }) => [slot, uuid]));

const CUSTOM_SLOTS = Array.from(
  { length: CUSTOM_SOUND_SLOTS },
  (_, slot) => slot,
);

export interface StaleSlots {
  restored: number[];
  local: number[];
}

export interface SoundOutcome {
  soundResets: number;
  staleSlots: StaleSlots;
}

async function resetSongSounds(
  db: Database,
  plan: ImportPlan,
  writes: Writes,
  snapshot: Snapshot,
): Promise<SoundOutcome> {
  const restored = new Set(
    (writes.songPresets ?? []).map(({ record }) =>
      recordKey('songPresets', record),
    ),
  );
  const fromFile = slotSounds(plan.file.records.clickSounds);
  const before = slotSounds(snapshot.records.clickSounds);
  const after = slotSounds(await db.select().from(clickSounds));
  const slotChanged = (slot: number) => before.get(slot) !== after.get(slot);
  const slotMissesBackupSound = (slot: number) => {
    const intended = fromFile.get(slot);
    return intended === undefined || intended !== after.get(slot);
  };
  const soundResets = await resetStaleSounds(db, (presetUuid, slot) =>
    restored.has(presetUuid) ? slotMissesBackupSound(slot) : slotChanged(slot),
  );
  return {
    soundResets,
    staleSlots: {
      restored: CUSTOM_SLOTS.filter(slotMissesBackupSound),
      local: CUSTOM_SLOTS.filter(slotChanged),
    },
  };
}

export async function applyWrites(
  db: Database,
  plan: ImportPlan,
  writes: Writes,
  snapshot: Snapshot,
  fileContext: FileContext,
): Promise<SoundOutcome> {
  const { ids } = snapshot;
  const deviceStemSets = new Map(ids.stemSongs);
  const stemEntries = await loadStemEntries(db);
  if (plan.mode === 'replace') {
    for (const category of [...plan.categories].reverse()) {
      await deleteCategory(db, category);
      ids[category].clear();
    }
    if (plan.categories.includes('clickSounds'))
      fileContext.log.replaced.push(
        ...snapshot.records.clickSounds.map(({ fileName }) => fileName),
      );
  }
  await upsertAll(db, plan, writes, {
    ...fileContext,
    ids,
    deviceStemSets,
    stemEntries,
  });
  if (plan.mode === 'replace') await relinkUntouched(db, plan, snapshot);
  if (plan.categories.includes('setlists'))
    await adoptActiveSetlist(db, plan, ids);
  return resetSongSounds(db, plan, writes, snapshot);
}
