import { and, asc, eq } from 'drizzle-orm';

import {
  stemSongKey,
  type StemMixRecord,
  type StemSongRecord,
} from './backup-format';
import { saveStemSetClick, stemSetClickOf } from './click-settings';
import { meterOverrideOf, saveMeterOverride } from './meter-override';
import type { Database } from './repository';
import { stems, stemSets } from './schema';
import { parseRetimedLyrics, saveLyricsRetimed } from './stem-lyrics';
import { renameStemSet } from './stem-rename';
import { STEM_SET_SOURCE } from './stem-set-source';
import {
  carriedTempoMode,
  saveChosenTempoMode,
  STEM_SET_TEMPO_COLUMNS,
  stemSetTempoOf,
} from './stem-tempo';

type StemSetRow = typeof stemSets.$inferSelect;
type StemRow = typeof stems.$inferSelect;

function mixRecord(row: StemRow): StemMixRecord {
  const { role, name, gain, muted, soloed, pitch } = row;
  return { role, name, gain, muted, soloed, pitch };
}

function identityOf(row: StemSetRow) {
  if (row.source === STEM_SET_SOURCE.stemdeck)
    return row.stemdeckJobId === null
      ? null
      : { stemdeckJobId: row.stemdeckJobId, uuid: null };
  return { stemdeckJobId: null, uuid: row.uuid };
}

function stemSongRecord(
  row: StemSetRow,
  identity: Pick<StemSongRecord, 'stemdeckJobId' | 'uuid'>,
  mixes: readonly StemRow[],
): StemSongRecord {
  return {
    source: row.source,
    ...identity,
    label: row.name,
    title: row.renamed ? row.name : null,
    ...meterOverrideOf(row),
    speed: row.speed,
    lyricsRetimed: parseRetimedLyrics(row.lyricsRetimed),
    ...stemSetClickOf(row),
    chosenTempoMode: stemSetTempoOf(row).chosenTempoMode,
    stems: mixes.map(mixRecord),
  };
}

export async function loadStemSongs(db: Database) {
  const setRows = await db.select().from(stemSets).orderBy(asc(stemSets.id));
  const stemRows = await db
    .select()
    .from(stems)
    .orderBy(asc(stems.sortOrder), asc(stems.id));
  const records: StemSongRecord[] = [];
  const ids = new Map<string, number>();
  for (const row of setRows) {
    const identity = identityOf(row);
    if (identity === null) continue;
    const mixes = stemRows.filter((stem) => stem.stemSetId === row.id);
    const record = stemSongRecord(row, identity, mixes);
    records.push(record);
    ids.set(stemSongKey(record), row.id);
  }
  return { records, ids };
}

function settingsOf(record: StemSongRecord, roles: ReadonlySet<string>) {
  const shared = record.stems
    .filter(({ role }) => roles.has(role))
    .sort((a, b) => a.role.localeCompare(b.role));
  return { ...record, label: null, stems: shared };
}

function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, field: unknown) =>
    field !== null && typeof field === 'object' && !Array.isArray(field)
      ? Object.fromEntries(
          Object.entries(field).sort(([a], [b]) => a.localeCompare(b)),
        )
      : field,
  );
}

// Only roles on both sides are compared: a restore never adds or removes a stem.
export function sameStemSong(
  mine: StemSongRecord,
  theirs: StemSongRecord,
): boolean {
  const theirRoles = new Set(theirs.stems.map(({ role }) => role));
  const roles = new Set(
    mine.stems.map(({ role }) => role).filter((role) => theirRoles.has(role)),
  );
  return (
    canonical(settingsOf(mine, roles)) === canonical(settingsOf(theirs, roles))
  );
}

async function restoreTempoMode(
  db: Database,
  id: number,
  record: StemSongRecord,
) {
  const [row] = await db
    .select(STEM_SET_TEMPO_COLUMNS)
    .from(stemSets)
    .where(eq(stemSets.id, id));
  const tempo = row === undefined ? null : stemSetTempoOf(row).tempo;
  await saveChosenTempoMode(
    db,
    id,
    carriedTempoMode(record.chosenTempoMode, tempo),
  );
}

async function restoreMixes(
  db: Database,
  id: number,
  mixes: readonly StemMixRecord[],
) {
  for (const { role, ...mix } of mixes)
    await db
      .update(stems)
      .set(mix)
      .where(and(eq(stems.stemSetId, id), eq(stems.role, role)));
}

export async function restoreStemSong(
  db: Database,
  record: StemSongRecord,
  localId: number | undefined,
): Promise<number> {
  if (localId === undefined)
    throw new Error(`Stem song ${stemSongKey(record)} is not on this device`);
  const { meterBeatsPerBar, barOneSeconds, clickGrouping, clickRate } = record;
  if (record.title !== null) await renameStemSet(db, localId, record.title);
  await saveMeterOverride(db, stemSets, localId, {
    meterBeatsPerBar,
    barOneSeconds,
  });
  await saveLyricsRetimed(db, localId, record.lyricsRetimed);
  await saveStemSetClick(db, localId, { clickGrouping, clickRate });
  await restoreTempoMode(db, localId, record);
  await db
    .update(stemSets)
    .set({ speed: record.speed })
    .where(eq(stemSets.id, localId));
  await restoreMixes(db, localId, record.stems);
  return localId;
}
