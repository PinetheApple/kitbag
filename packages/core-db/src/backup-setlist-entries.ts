import { asc, eq, isNotNull } from 'drizzle-orm';

import type { SetlistItemRecord, SetlistRecord } from './backup-format';
import type { IdMaps } from './backup-snapshot';
import type { Database } from './repository';
import { setlistItems, setlists } from './schema';

export interface SetlistEntryContext {
  ids: IdMaps;
  deviceStemSets: ReadonlyMap<string, number>;
  stemEntries: ReadonlyMap<string, number[]>;
}

type EntryRef = { songPresetId: number } | { stemSetId: number };

function presetRef(uuid: string, ids: IdMaps): EntryRef {
  const songPresetId = ids.songPresets.get(uuid);
  if (songPresetId === undefined)
    throw new Error(`Song preset ${uuid} missing`);
  return { songPresetId };
}

function itemRef(
  item: SetlistItemRecord,
  context: SetlistEntryContext,
): EntryRef {
  if ('preset' in item) return presetRef(item.preset, context.ids);
  const stemSetId = context.deviceStemSets.get(item.stemSong);
  if (stemSetId === undefined)
    throw new Error(`Stem song ${item.stemSong} missing`);
  return { stemSetId };
}

// A file from before setlist items cannot speak for stem entries, so they stay.
export function entryRefs(
  record: SetlistRecord,
  context: SetlistEntryContext,
): EntryRef[] {
  if (record.items !== undefined)
    return record.items.map((item) => itemRef(item, context));
  const kept = context.stemEntries.get(record.uuid) ?? [];
  return [
    ...record.presetUuids.map((uuid) => presetRef(uuid, context.ids)),
    ...kept.map((stemSetId) => ({ stemSetId })),
  ];
}

export async function loadStemEntries(db: Database) {
  const rows = await db
    .select({ uuid: setlists.uuid, stemSetId: setlistItems.stemSetId })
    .from(setlistItems)
    .innerJoin(setlists, eq(setlists.id, setlistItems.setlistId))
    .where(isNotNull(setlistItems.stemSetId))
    .orderBy(asc(setlistItems.position), asc(setlistItems.id));
  const entries = new Map<string, number[]>();
  for (const { uuid, stemSetId } of rows)
    if (stemSetId !== null)
      entries.set(uuid, [...(entries.get(uuid) ?? []), stemSetId]);
  return entries;
}
