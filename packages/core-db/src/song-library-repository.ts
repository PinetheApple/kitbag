import { count, eq, inArray, max, sql } from 'drizzle-orm';

import { ANALYSIS_STATUS, type AnalysisStatus } from './analysis-status';
import { packFloat32, packInt32 } from './packing';
import { found, type Database, type DatabaseHandle } from './repository';
import { setlistItems, songPresets, songs, stems, stemSets } from './schema';
import {
  deleteStemSet,
  findStemSetByJobId,
  insertStemBundle,
  readStemSet,
  replaceStemBundle,
  type NewStemBundle,
} from './stem-bundle-repository';

export interface LibrarySongRow {
  readonly kind: 'song';
  readonly id: number;
  readonly title: string;
  readonly artist: string;
  readonly durationSec: number;
  readonly bpm: number | null;
  readonly hasGrid: boolean;
  readonly analysisStatus: AnalysisStatus;
  readonly analysisError: string | null;
  readonly inSetlist: boolean;
  readonly createdAt: Date;
}

export interface LibraryStemSetRow {
  readonly kind: 'stems';
  readonly id: number;
  readonly title: string;
  readonly stemCount: number;
  readonly durationSec: number;
  readonly createdAt: Date;
}

export type LibraryRow = LibrarySongRow | LibraryStemSetRow;

export interface NewLibrarySong {
  readonly uuid: string;
  readonly title: string;
  readonly artist: string;
  readonly filePath: string;
  readonly durationSec: number;
  readonly format: string;
}

export interface SongFiles {
  readonly uuid: string;
  readonly filePath: string;
  readonly waveformPath: string | null;
}

export type AnalysisResultRecord =
  | ({ readonly filePath: string; readonly ok: true } & StoredAnalysis)
  | {
      readonly filePath: string;
      readonly ok: false;
      readonly error: string;
    };

export interface StoredAnalysis {
  readonly bpm: number | null;
  readonly beats: readonly number[];
  readonly downbeats: readonly number[];
  readonly waveformPath: string | null;
}

export interface AnalysisOutcome {
  readonly found: boolean;
  readonly unusedWaveform: string | null;
}

async function songsInSetlists(db: Database): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ songId: songPresets.librarySongId })
    .from(setlistItems)
    .innerJoin(songPresets, eq(songPresets.id, setlistItems.songPresetId));
  return new Set(
    rows.flatMap(({ songId }) => (songId === null ? [] : [songId])),
  );
}

async function songRows(db: Database): Promise<LibrarySongRow[]> {
  const listed = await songsInSetlists(db);
  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      artist: songs.artist,
      durationSec: songs.duration,
      bpm: songs.bpm,
      hasGrid: sql<number>`${songs.beatGrid} IS NOT NULL`,
      analysisStatus: songs.analysisStatus,
      analysisError: songs.analysisError,
      createdAt: songs.createdAt,
    })
    .from(songs);
  return rows.map((row) => ({
    ...row,
    kind: 'song',
    hasGrid: row.hasGrid !== 0,
    inSetlist: listed.has(row.id),
  }));
}

async function stemSetRows(db: Database): Promise<LibraryStemSetRow[]> {
  const rows = await db
    .select({
      id: stemSets.id,
      title: stemSets.name,
      stemCount: count(stems.id),
      durationSec: max(stems.duration),
      createdAt: stemSets.createdAt,
    })
    .from(stemSets)
    .leftJoin(stems, eq(stems.stemSetId, stemSets.id))
    .groupBy(stemSets.id);
  return rows.map((row) => ({
    ...row,
    kind: 'stems',
    durationSec: row.durationSec ?? 0,
  }));
}

async function listRows(db: Database): Promise<LibraryRow[]> {
  const rows = [...(await songRows(db)), ...(await stemSetRows(db))];
  // created_at has whole-second resolution, so ids order same-second imports.
  return rows.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
  );
}

async function insertSong(db: Database, song: NewLibrarySong) {
  const row = found(
    await db
      .insert(songs)
      .values({
        title: song.title,
        artist: song.artist,
        filePath: song.filePath,
        duration: song.durationSec,
        format: song.format,
        createdAt: new Date(),
        uuid: song.uuid,
        analysisStatus: ANALYSIS_STATUS.analyzing,
      })
      .returning({ id: songs.id }),
    'Song insert',
  );
  return row.id;
}

async function waveformInUse(db: Database, path: string): Promise<boolean> {
  const [row] = await db
    .select({ n: count() })
    .from(songs)
    .where(eq(songs.waveformPath, path));
  return (row?.n ?? 0) > 0;
}

async function unreferenced(db: Database, path: string | null) {
  return path === null || (await waveformInUse(db, path)) ? null : path;
}

function analysisFields(result: AnalysisResultRecord) {
  if (!result.ok)
    return {
      analysisStatus: ANALYSIS_STATUS.failed,
      analysisError: result.error,
    };
  const gridded = result.beats.length > 0;
  return {
    bpm: result.bpm,
    beatGrid: gridded ? packFloat32(result.beats) : null,
    downbeatIndices: gridded ? packInt32(result.downbeats) : null,
    waveformPath: result.waveformPath,
    analysisStatus: ANALYSIS_STATUS.done,
    analysisError: null,
  };
}

// A failure keeps the previous analysis: native only replaces the waveform once
// a new one is complete.
async function applyAnalysis(
  db: Database,
  result: AnalysisResultRecord,
): Promise<AnalysisOutcome> {
  const newWaveform = result.ok ? result.waveformPath : null;
  const [previous] = await db
    .select({ id: songs.id, waveformPath: songs.waveformPath })
    .from(songs)
    .where(eq(songs.filePath, result.filePath));
  if (previous === undefined)
    return {
      found: false,
      unusedWaveform: await unreferenced(db, newWaveform),
    };
  await db
    .update(songs)
    .set(analysisFields(result))
    .where(eq(songs.id, previous.id));
  const replaced =
    result.ok && previous.waveformPath !== newWaveform
      ? previous.waveformPath
      : null;
  return { found: true, unusedWaveform: await unreferenced(db, replaced) };
}

const songFiles = {
  uuid: songs.uuid,
  filePath: songs.filePath,
  waveformPath: songs.waveformPath,
};

async function beginAnalysis(
  db: Database,
  id: number,
): Promise<SongFiles | undefined> {
  const [row] = await db
    .update(songs)
    .set({ analysisStatus: ANALYSIS_STATUS.analyzing, analysisError: null })
    .where(eq(songs.id, id))
    .returning(songFiles);
  return row;
}

async function claimUnfinished(db: Database): Promise<SongFiles[]> {
  return db
    .update(songs)
    .set({ analysisStatus: ANALYSIS_STATUS.analyzing })
    .where(
      inArray(songs.analysisStatus, [
        ANALYSIS_STATUS.pending,
        ANALYSIS_STATUS.analyzing,
      ]),
    )
    .returning(songFiles);
}

async function deleteSong(
  db: Database,
  id: number,
): Promise<SongFiles | undefined> {
  const [row] = await db.select(songFiles).from(songs).where(eq(songs.id, id));
  if (row === undefined) return undefined;
  await db
    .update(songPresets)
    .set({ librarySongId: null })
    .where(eq(songPresets.librarySongId, id));
  await db.delete(songs).where(eq(songs.id, id));
  return row;
}

export function createSongLibraryRepository({
  db,
  transactor,
}: DatabaseHandle) {
  const { serial, transaction } = transactor;
  return {
    list: () => serial(() => listRows(db)),
    insertSong: (song: NewLibrarySong) => serial(() => insertSong(db, song)),
    beginAnalysis: (id: number) => serial(() => beginAnalysis(db, id)),
    claimUnfinishedAnalyses: () => serial(() => claimUnfinished(db)),
    applyAnalysis: (result: AnalysisResultRecord) =>
      transaction(() => applyAnalysis(db, result)),
    deleteSong: (id: number) => transaction(() => deleteSong(db, id)),
    deleteStemSet: (id: number) => transaction(() => deleteStemSet(db, id)),
    findStemSetByJobId: (jobId: string) =>
      serial(() => findStemSetByJobId(db, jobId)),
    insertStemBundle: (bundle: NewStemBundle) =>
      transaction(() => insertStemBundle(db, bundle)),
    replaceStemBundle: (bundle: NewStemBundle) =>
      transaction(() => replaceStemBundle(db, bundle)),
    readStemSet: (id: number) => serial(() => readStemSet(db, id)),
  };
}

export type SongLibraryRepository = ReturnType<
  typeof createSongLibraryRepository
>;
