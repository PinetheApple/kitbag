import { and, asc, eq } from 'drizzle-orm';

import {
  stemSongKey,
  type LocalStemSong,
  type StemMixRecord,
  type StemSongRecord,
} from './backup-format';
import { storedManualTempoColumns } from './backup-manual-tempo';
import { saveStemSetClick, stemSetClickOf } from './click-settings';
import { meterOverrideOf, saveMeterOverride } from './meter-override';
import type { Database } from './repository';
import { stems, stemSets } from './schema';
import { parseRetimedLyrics, saveLyricsRetimed } from './stem-lyrics';
import { renameStemSet } from './stem-rename';
import { STEM_SET_SOURCE } from './stem-set-source';
import { saveChosenTempoMode, storedTempoOf } from './stem-tempo';

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

function lyricsOf(row: StemSetRow) {
  const { lyricsSynced, lyricsPlain, lyricsInstrumental } = row;
  return lyricsInstrumental === null
    ? null
    : {
        synced: lyricsSynced,
        plain: lyricsPlain,
        instrumental: lyricsInstrumental,
      };
}

function stemSongRecord(
  row: StemSetRow,
  identity: Pick<StemSongRecord, 'stemdeckJobId' | 'uuid'>,
  mixes: readonly StemRow[],
): LocalStemSong {
  return {
    source: row.source,
    ...identity,
    label: row.name,
    title: row.renamed ? row.name : null,
    ...meterOverrideOf(row),
    speed: row.speed,
    pitch: row.pitch,
    lyricsRetimed: parseRetimedLyrics(row.lyricsRetimed),
    ...stemSetClickOf(row),
    chosenTempoMode: storedTempoOf(row).chosenTempoMode,
    ...storedManualTempoColumns(row),
    stems: mixes.map(mixRecord),
    lyrics: lyricsOf(row),
    tempo: storedTempoOf(row).tempo,
  };
}

export function portableStemSong(song: LocalStemSong): StemSongRecord {
  const copy: Partial<LocalStemSong> = { ...song };
  delete copy.lyrics;
  delete copy.tempo;
  return copy as StemSongRecord;
}

export async function loadStemSongs(db: Database) {
  const setRows = await db.select().from(stemSets).orderBy(asc(stemSets.id));
  const stemRows = await db
    .select()
    .from(stems)
    .orderBy(asc(stems.sortOrder), asc(stems.id));
  const records: LocalStemSong[] = [];
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

async function restoreMixes(
  db: Database,
  id: number,
  mixes: readonly StemMixRecord[],
) {
  for (const { role, name, ...mix } of mixes)
    await db
      .update(stems)
      .set(name === null ? mix : { ...mix, name })
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
  await saveChosenTempoMode(db, stemSets, localId, record.chosenTempoMode);
  const carriesManualTempo = record.manualTempoBpm !== undefined;
  await db
    .update(stemSets)
    .set({
      speed: record.speed,
      pitch: record.pitch,
      ...(carriesManualTempo ? storedManualTempoColumns(record) : {}),
    })
    .where(eq(stemSets.id, localId));
  await restoreMixes(db, localId, record.stems);
  return localId;
}
