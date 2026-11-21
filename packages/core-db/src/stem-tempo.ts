import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';

import { unpackBars, unpackFloat32 } from './packing';
import type { Database } from './repository';
import { songs, stemSets } from './schema';
import type { BarMark } from './stem-bundle-repository';
import {
  TEMPO_MAX_BEATS_PER_BAR,
  TEMPO_MAX_BPM,
  TEMPO_MIN_ANCHOR_SECONDS,
  TEMPO_MIN_BEATS_PER_BAR,
  TEMPO_MIN_BPM,
  TEMPO_MODE,
  TEMPO_MODES,
  TEMPO_SOURCES,
  type TempoMode,
  type TempoSource,
} from './tempo-mode';

export interface BundleTempo {
  readonly mode: TempoMode;
  readonly bpm: number | null;
  readonly anchor: number | null;
  readonly beatsPerBar: number;
  readonly source: TempoSource;
}

export interface FittedTempo {
  readonly bpm: number;
  readonly anchor: number;
  readonly beatsPerBar: number;
}

export interface StoredTempo {
  readonly tempo: BundleTempo | null;
  readonly chosenTempoMode: TempoMode | null;
}

type LooseBundleTempo = { readonly [K in keyof BundleTempo]: unknown };

export interface BundleTempoViolation {
  readonly field: keyof BundleTempo;
  readonly reason: string;
}

export function isTempoMode(value: unknown): value is TempoMode {
  return TEMPO_MODES.some((mode) => mode === value);
}

const isTempoSource = (value: unknown): value is TempoSource =>
  TEMPO_SOURCES.some((source) => source === value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

type TempoCheck = (value: unknown, tempo: LooseBundleTempo) => boolean;

// StemDeck leaves bpm and anchor out of a follow tempo when it detected none.
const presentOrUntimedFollow =
  (valid: (value: number) => boolean): TempoCheck =>
  (value, tempo) =>
    value === null
      ? tempo.mode === TEMPO_MODE.follow
      : isFiniteNumber(value) && valid(value);

const within =
  (min: number, max: number) =>
  (value: number): boolean =>
    value >= min && value <= max;

const TEMPO_CHECKS: readonly (readonly [keyof BundleTempo, TempoCheck])[] = [
  ['mode', isTempoMode],
  ['bpm', presentOrUntimedFollow(within(TEMPO_MIN_BPM, TEMPO_MAX_BPM))],
  [
    'anchor',
    presentOrUntimedFollow((anchor) => anchor >= TEMPO_MIN_ANCHOR_SECONDS),
  ],
  [
    'beatsPerBar',
    (value) =>
      Number.isInteger(value) &&
      within(TEMPO_MIN_BEATS_PER_BAR, TEMPO_MAX_BEATS_PER_BAR)(Number(value)),
  ],
  ['source', isTempoSource],
];

export function bundleTempoViolation(
  tempo: LooseBundleTempo,
): BundleTempoViolation | null {
  const failed = TEMPO_CHECKS.find(
    ([field, valid]) => !valid(tempo[field], tempo),
  );
  if (failed === undefined) return null;
  const [field] = failed;
  return { field, reason: `Bad tempo ${field}: ${String(tempo[field])}` };
}

function isBundleTempo(tempo: LooseBundleTempo): tempo is BundleTempo {
  return bundleTempoViolation(tempo) === null;
}

export function bundleTempoOf(
  tempo: LooseBundleTempo | null,
): BundleTempo | null {
  if (tempo === null || !isBundleTempo(tempo)) return null;
  const { mode, bpm, anchor, beatsPerBar, source } = tempo;
  return { mode, bpm, anchor, beatsPerBar, source };
}

// A constant bundle carries no follow beats; a follow bundle's bpm and anchor
// rebuild the constant grid.
export function canBuildTempoMode(
  tempo: BundleTempo | null,
  mode: TempoMode,
): boolean {
  if (tempo === null) return false;
  if (mode === tempo.mode) return true;
  return (
    mode === TEMPO_MODE.constant && tempo.bpm !== null && tempo.anchor !== null
  );
}

export function carriedTempoMode(
  chosen: TempoMode | null,
  tempo: BundleTempo | null,
): TempoMode | null {
  return chosen !== null && canBuildTempoMode(tempo, chosen) ? chosen : null;
}

export interface TempoColumns {
  readonly tempoMode: TempoMode | null;
  readonly tempoBpm: number | null;
  readonly tempoAnchor: number | null;
  readonly tempoBeatsPerBar: number | null;
  readonly tempoSource: TempoSource | null;
  readonly chosenTempoMode: TempoMode | null;
}

export type BundleTempoColumns = Omit<TempoColumns, 'chosenTempoMode'>;

export const TEMPO_COLUMN_OF: Readonly<
  Record<keyof BundleTempo, keyof BundleTempoColumns>
> = {
  mode: 'tempoMode',
  bpm: 'tempoBpm',
  anchor: 'tempoAnchor',
  beatsPerBar: 'tempoBeatsPerBar',
  source: 'tempoSource',
};

const NO_TEMPO_COLUMNS: BundleTempoColumns = {
  tempoMode: null,
  tempoBpm: null,
  tempoAnchor: null,
  tempoBeatsPerBar: null,
  tempoSource: null,
};

export const NO_STORED_TEMPO_COLUMNS: TempoColumns = {
  ...NO_TEMPO_COLUMNS,
  chosenTempoMode: null,
};

export function bundleTempoColumns(
  tempo: BundleTempo | null,
): BundleTempoColumns {
  if (tempo === null) return NO_TEMPO_COLUMNS;
  const violation = bundleTempoViolation(tempo);
  if (violation) throw new RangeError(violation.reason);
  return {
    tempoMode: tempo.mode,
    tempoBpm: tempo.bpm,
    tempoAnchor: tempo.anchor,
    tempoBeatsPerBar: tempo.beatsPerBar,
    tempoSource: tempo.source,
  };
}

type TempoTable = typeof songs | typeof stemSets;

export function tempoColumnsOf(table: TempoTable) {
  return {
    tempoMode: table.tempoMode,
    tempoBpm: table.tempoBpm,
    tempoAnchor: table.tempoAnchor,
    tempoBeatsPerBar: table.tempoBeatsPerBar,
    tempoSource: table.tempoSource,
    chosenTempoMode: table.chosenTempoMode,
  };
}

export const STEM_SET_TEMPO_COLUMNS = tempoColumnsOf(stemSets);

export function storedTempoOf(row: {
  readonly tempoMode: string | null;
  readonly tempoBpm: number | null;
  readonly tempoAnchor: number | null;
  readonly tempoBeatsPerBar: number | null;
  readonly tempoSource: string | null;
  readonly chosenTempoMode: string | null;
}): StoredTempo {
  const tempo = bundleTempoOf({
    mode: row.tempoMode,
    bpm: row.tempoBpm,
    anchor: row.tempoAnchor,
    beatsPerBar: row.tempoBeatsPerBar,
    source: row.tempoSource,
  });
  const chosen = isTempoMode(row.chosenTempoMode) ? row.chosenTempoMode : null;
  return { tempo, chosenTempoMode: carriedTempoMode(chosen, tempo) };
}

export function storedTempoColumns({
  tempo,
  chosenTempoMode,
}: StoredTempo): TempoColumns {
  return { ...bundleTempoColumns(tempo), chosenTempoMode };
}

async function rowTempo(
  db: Database,
  table: TempoTable,
  id: number,
): Promise<BundleTempo | null> {
  const [row] = await db
    .select(tempoColumnsOf(table))
    .from(table)
    .where(eq(table.id, id));
  return row === undefined ? null : storedTempoOf(row).tempo;
}

async function checkedChoice(
  db: Database,
  table: TempoTable,
  id: number,
  mode: TempoMode,
): Promise<void> {
  if (!isTempoMode(mode))
    throw new RangeError(`Unknown tempo mode ${String(mode)}`);
  if (!canBuildTempoMode(await rowTempo(db, table, id), mode))
    throw new RangeError(`Row ${String(id)} cannot build ${mode} tempo`);
}

export async function saveChosenTempoMode(
  db: Database,
  table: TempoTable,
  id: number,
  mode: TempoMode | null,
): Promise<void> {
  if (mode !== null) await checkedChoice(db, table, id, mode);
  await db.update(table).set({ chosenTempoMode: mode }).where(eq(table.id, id));
}

export interface UntimedStemSet {
  readonly id: number;
  readonly beats: readonly number[];
  readonly bars: readonly BarMark[];
}

export async function listStemSetsWithoutTempo(
  db: Database,
): Promise<UntimedStemSet[]> {
  const rows = await db
    .select({
      id: stemSets.id,
      beatGrid: stemSets.beatGrid,
      barMarks: stemSets.barMarks,
    })
    .from(stemSets)
    .where(and(isNotNull(stemSets.beatGrid), isNull(stemSets.tempoMode)))
    .orderBy(asc(stemSets.id));
  return rows.flatMap(({ id, beatGrid, barMarks }) =>
    beatGrid === null
      ? []
      : [
          {
            id,
            beats: unpackFloat32(beatGrid),
            bars: barMarks === null ? [] : unpackBars(barMarks),
          },
        ],
  );
}

export async function saveStemSetTempo(
  db: Database,
  id: number,
  tempo: BundleTempo,
): Promise<void> {
  await db
    .update(stemSets)
    .set(bundleTempoColumns(tempo))
    .where(and(eq(stemSets.id, id), isNull(stemSets.tempoMode)));
}
