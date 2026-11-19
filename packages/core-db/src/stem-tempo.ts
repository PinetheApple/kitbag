import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { stemSets } from './schema';
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

export interface StemSetTempo {
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

export function bundleTempoColumns(tempo: BundleTempo | null) {
  if (tempo === null) return {};
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

export const STEM_SET_TEMPO_COLUMNS = {
  tempoMode: stemSets.tempoMode,
  tempoBpm: stemSets.tempoBpm,
  tempoAnchor: stemSets.tempoAnchor,
  tempoBeatsPerBar: stemSets.tempoBeatsPerBar,
  tempoSource: stemSets.tempoSource,
  chosenTempoMode: stemSets.chosenTempoMode,
};

export function stemSetTempoOf(row: {
  readonly tempoMode: string | null;
  readonly tempoBpm: number | null;
  readonly tempoAnchor: number | null;
  readonly tempoBeatsPerBar: number | null;
  readonly tempoSource: string | null;
  readonly chosenTempoMode: string | null;
}): StemSetTempo {
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

async function rowTempo(db: Database, id: number): Promise<BundleTempo | null> {
  const [row] = await db
    .select(STEM_SET_TEMPO_COLUMNS)
    .from(stemSets)
    .where(eq(stemSets.id, id));
  return row === undefined ? null : stemSetTempoOf(row).tempo;
}

async function checkedChoice(
  db: Database,
  id: number,
  mode: TempoMode,
): Promise<void> {
  if (!isTempoMode(mode))
    throw new RangeError(`Unknown tempo mode ${String(mode)}`);
  if (!canBuildTempoMode(await rowTempo(db, id), mode))
    throw new RangeError(`Stem set ${String(id)} cannot build ${mode} tempo`);
}

export async function saveChosenTempoMode(
  db: Database,
  id: number,
  mode: TempoMode | null,
): Promise<void> {
  if (mode !== null) await checkedChoice(db, id, mode);
  await db
    .update(stemSets)
    .set({ chosenTempoMode: mode })
    .where(eq(stemSets.id, id));
}
