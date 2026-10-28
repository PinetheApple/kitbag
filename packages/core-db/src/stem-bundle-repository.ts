import { asc, eq } from 'drizzle-orm';

import { found, type Database } from './repository';
import { stems, stemSets } from './schema';
import { packFloat32, packInt32, unpackFloat32, unpackInt32 } from './packing';
import { STEM_SET_SOURCE, type StemSetSource } from './stem-set-source';

const STEM_FORMAT = 'flac';
const BAR_MARK_FIELDS = 2;

export interface BundleStem {
  readonly name: string;
  readonly filePath: string;
  readonly waveformPath: string | null;
  readonly frames: number;
  readonly volume: number;
  readonly muted: boolean;
  readonly soloed: boolean;
  readonly pitch: number;
}

export interface StoredSection {
  readonly name: string;
  readonly kind: string;
  readonly color: string;
  readonly startSec: number;
  readonly endSec: number;
}

export interface BarMark {
  readonly beat: number;
  readonly beatsPerBar: number;
}

export interface StoredLyrics {
  readonly synced: string | null;
  readonly plain: string | null;
  readonly offsetSec: number;
  readonly instrumental: boolean;
}

export interface NewStemBundle {
  readonly uuid: string;
  readonly jobId: string;
  readonly title: string;
  readonly folder: string;
  readonly sampleRate: number;
  readonly channels: number;
  readonly stems: readonly BundleStem[];
  readonly bpm: number | null;
  readonly key: string | null;
  readonly scale: string | null;
  readonly keyConfidence: number | null;
  readonly loudnessLufs: number | null;
  readonly tempoStability: number | null;
  readonly sections: readonly StoredSection[];
  readonly beats: readonly number[];
  readonly bars: readonly BarMark[];
  readonly lyrics: StoredLyrics | null;
}

export interface StoredStem extends BundleStem {
  readonly id: number;
  readonly durationSec: number;
  readonly format: string;
  readonly channels: number;
  readonly sampleRate: number;
}

export interface StemSetRecord extends Omit<
  NewStemBundle,
  'jobId' | 'folder' | 'stems' | 'sampleRate' | 'channels'
> {
  readonly id: number;
  readonly source: StemSetSource;
  readonly jobId: string | null;
  readonly folder: string | null;
  readonly sampleRate: number | null;
  readonly createdAt: Date;
  readonly speed: number;
  readonly lyricsRetimed: string | null;
  readonly stems: readonly StoredStem[];
}

export interface StemSetFiles {
  readonly folder: string | null;
  readonly files: readonly string[];
}

export interface ExistingStemSet {
  readonly id: number;
  readonly title: string;
}

export interface StemBundleReplacement {
  readonly id: number;
  readonly replaced: StemSetFiles | null;
}

function packBars(bars: readonly BarMark[]): Uint8Array {
  return packInt32(bars.flatMap((bar) => [bar.beat, bar.beatsPerBar]));
}

function unpackBars(bytes: Uint8Array): BarMark[] {
  const values = unpackInt32(bytes);
  const bars: BarMark[] = [];
  for (let i = 0; i + 1 < values.length; i += BAR_MARK_FIELDS)
    bars.push({ beat: values[i] ?? 0, beatsPerBar: values[i + 1] ?? 0 });
  return bars;
}

function isSection(value: unknown): value is StoredSection {
  if (typeof value !== 'object' || value === null) return false;
  const section = value as Record<string, unknown>;
  return (
    typeof section.name === 'string' &&
    typeof section.kind === 'string' &&
    typeof section.color === 'string' &&
    typeof section.startSec === 'number' &&
    typeof section.endSec === 'number'
  );
}

function parseSections(text: string | null): StoredSection[] {
  if (text === null) return [];
  const parsed: unknown = JSON.parse(text);
  return Array.isArray(parsed) ? parsed.filter(isSection) : [];
}

function setValues(bundle: NewStemBundle) {
  const { lyrics } = bundle;
  return {
    name: bundle.title,
    createdAt: new Date(),
    uuid: bundle.uuid,
    source: STEM_SET_SOURCE.stemdeck,
    stemdeckJobId: bundle.jobId,
    key: bundle.key,
    scale: bundle.scale,
    keyConfidence: bundle.keyConfidence,
    bpm: bundle.bpm,
    loudnessLufs: bundle.loudnessLufs,
    tempoStability: bundle.tempoStability,
    beatGrid: bundle.beats.length > 0 ? packFloat32(bundle.beats) : null,
    barMarks: bundle.bars.length > 0 ? packBars(bundle.bars) : null,
    sections:
      bundle.sections.length > 0 ? JSON.stringify(bundle.sections) : null,
    lyricsSynced: lyrics?.synced ?? null,
    lyricsPlain: lyrics?.plain ?? null,
    lyricsOffset: lyrics?.offsetSec ?? null,
    lyricsInstrumental: lyrics?.instrumental ?? null,
    sampleRate: bundle.sampleRate,
    folder: bundle.folder,
  };
}

function stemValues(bundle: NewStemBundle, stemSetId: number) {
  return bundle.stems.map((stem, sortOrder) => ({
    stemSetId,
    role: stem.name,
    filePath: stem.filePath,
    duration: stem.frames / bundle.sampleRate,
    format: STEM_FORMAT,
    channelCount: bundle.channels,
    sampleRate: bundle.sampleRate,
    gain: stem.volume,
    muted: stem.muted,
    soloed: stem.soloed,
    sortOrder,
    pitch: stem.pitch,
    waveformPath: stem.waveformPath,
    frames: stem.frames,
  }));
}

export async function insertStemBundle(
  db: Database,
  bundle: NewStemBundle,
): Promise<number> {
  const { id } = found(
    await db
      .insert(stemSets)
      .values(setValues(bundle))
      .returning({ id: stemSets.id }),
    'Stem set insert',
  );
  const rows = stemValues(bundle, id);
  if (rows.length > 0) await db.insert(stems).values(rows);
  return id;
}

export async function findStemSetByJobId(
  db: Database,
  jobId: string,
): Promise<ExistingStemSet | undefined> {
  const [row] = await db
    .select({ id: stemSets.id, title: stemSets.name })
    .from(stemSets)
    .where(eq(stemSets.stemdeckJobId, jobId));
  return row;
}

export async function deleteStemSet(
  db: Database,
  id: number,
): Promise<StemSetFiles> {
  const [set] = await db
    .select({ folder: stemSets.folder })
    .from(stemSets)
    .where(eq(stemSets.id, id));
  const owned = await db
    .select({ filePath: stems.filePath, waveformPath: stems.waveformPath })
    .from(stems)
    .where(eq(stems.stemSetId, id));
  await db.delete(stems).where(eq(stems.stemSetId, id));
  await db.delete(stemSets).where(eq(stemSets.id, id));
  return {
    folder: set?.folder ?? null,
    files: owned.flatMap(({ filePath, waveformPath }) =>
      waveformPath === null ? [filePath] : [filePath, waveformPath],
    ),
  };
}

export async function replaceStemBundle(
  db: Database,
  bundle: NewStemBundle,
): Promise<StemBundleReplacement> {
  const existing = await findStemSetByJobId(db, bundle.jobId);
  const replaced =
    existing === undefined ? null : await deleteStemSet(db, existing.id);
  return { id: await insertStemBundle(db, bundle), replaced };
}

async function readStems(db: Database, id: number): Promise<StoredStem[]> {
  const rows = await db
    .select()
    .from(stems)
    .where(eq(stems.stemSetId, id))
    .orderBy(asc(stems.sortOrder));
  return rows.map((row) => ({
    id: row.id,
    name: row.role,
    filePath: row.filePath,
    waveformPath: row.waveformPath,
    frames: row.frames ?? 0,
    durationSec: row.duration,
    format: row.format,
    channels: row.channelCount,
    sampleRate: row.sampleRate,
    volume: row.gain,
    muted: row.muted,
    soloed: row.soloed,
    pitch: row.pitch,
  }));
}

export async function readStemSet(
  db: Database,
  id: number,
): Promise<StemSetRecord | undefined> {
  const [row] = await db.select().from(stemSets).where(eq(stemSets.id, id));
  if (row === undefined) return undefined;
  const instrumental = row.lyricsInstrumental;
  return {
    id: row.id,
    uuid: row.uuid,
    title: row.name,
    source: row.source,
    jobId: row.stemdeckJobId,
    folder: row.folder,
    sampleRate: row.sampleRate,
    createdAt: row.createdAt,
    speed: row.speed,
    bpm: row.bpm,
    key: row.key,
    scale: row.scale,
    keyConfidence: row.keyConfidence,
    loudnessLufs: row.loudnessLufs,
    tempoStability: row.tempoStability,
    beats: row.beatGrid === null ? [] : unpackFloat32(row.beatGrid),
    bars: row.barMarks === null ? [] : unpackBars(row.barMarks),
    sections: parseSections(row.sections),
    lyrics:
      instrumental === null
        ? null
        : {
            synced: row.lyricsSynced,
            plain: row.lyricsPlain,
            offsetSec: row.lyricsOffset ?? 0,
            instrumental,
          },
    lyricsRetimed: row.lyricsRetimed,
    stems: await readStems(db, id),
  };
}
