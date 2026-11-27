import { eq } from 'drizzle-orm';

import {
  isGridMeter,
  meterOverrideViolation,
  type GridMeter,
  type MeterOverride,
} from './meter-override';
import type { Database } from './repository';
import type { songs, stemSets } from './schema';
import {
  TEMPO_MAX_BPM,
  TEMPO_MIN_ANCHOR_SECONDS,
  TEMPO_MIN_BPM,
} from './tempo-mode';

export interface ManualTempo {
  readonly bpm: number;
  readonly anchor: number;
  readonly beatsPerBar: GridMeter;
}

export interface ManualTempoColumns {
  readonly manualTempoBpm: number | null;
  readonly manualTempoAnchor: number | null;
  readonly manualTempoBeatsPerBar: number | null;
}

export interface ManualTempoChange {
  readonly manualTempo: ManualTempo | null;
  readonly meterOverride: MeterOverride;
}

export interface ManualTempoViolation {
  readonly field: keyof ManualTempoColumns;
  readonly reason: string;
}

export const NO_MANUAL_TEMPO_COLUMNS: ManualTempoColumns = {
  manualTempoBpm: null,
  manualTempoAnchor: null,
  manualTempoBeatsPerBar: null,
};

export const MANUAL_TEMPO_FIELDS = Object.keys(
  NO_MANUAL_TEMPO_COLUMNS,
) as (keyof ManualTempoColumns)[];

const finite = (value: number | null): value is number =>
  value !== null && Number.isFinite(value);

const CHECKS: readonly (readonly [
  keyof ManualTempoColumns,
  (value: number | null) => boolean,
])[] = [
  [
    'manualTempoBpm',
    (bpm) => finite(bpm) && bpm >= TEMPO_MIN_BPM && bpm <= TEMPO_MAX_BPM,
  ],
  [
    'manualTempoAnchor',
    (anchor) => finite(anchor) && anchor >= TEMPO_MIN_ANCHOR_SECONDS,
  ],
  ['manualTempoBeatsPerBar', isGridMeter],
];

export function manualTempoViolation(
  columns: ManualTempoColumns,
): ManualTempoViolation | null {
  if (MANUAL_TEMPO_FIELDS.every((field) => columns[field] === null))
    return null;
  const failed = CHECKS.find(([field, valid]) => !valid(columns[field]));
  if (failed === undefined) return null;
  const [field] = failed;
  return { field, reason: `Bad manual tempo: ${String(columns[field])}` };
}

export function manualTempoColumns(
  tempo: ManualTempo | null,
): ManualTempoColumns {
  if (tempo === null) return NO_MANUAL_TEMPO_COLUMNS;
  const columns = {
    manualTempoBpm: tempo.bpm,
    manualTempoAnchor: tempo.anchor,
    manualTempoBeatsPerBar: tempo.beatsPerBar,
  };
  const violation = manualTempoViolation(columns);
  if (violation) throw new RangeError(violation.reason);
  return columns;
}

export function manualTempoOf(row: ManualTempoColumns): ManualTempo | null {
  const { manualTempoBpm, manualTempoAnchor, manualTempoBeatsPerBar } = row;
  if (manualTempoViolation(row) !== null) return null;
  if (
    manualTempoBpm === null ||
    manualTempoAnchor === null ||
    !isGridMeter(manualTempoBeatsPerBar)
  )
    return null;
  return {
    bpm: manualTempoBpm,
    anchor: manualTempoAnchor,
    beatsPerBar: manualTempoBeatsPerBar,
  };
}

export async function saveManualTempo(
  db: Database,
  table: typeof songs | typeof stemSets,
  id: number,
  { manualTempo, meterOverride }: ManualTempoChange,
): Promise<void> {
  const meterViolation = meterOverrideViolation(meterOverride);
  if (meterViolation) throw new RangeError(meterViolation.reason);
  const { meterBeatsPerBar, barOneSeconds } = meterOverride;
  await db
    .update(table)
    .set({
      ...manualTempoColumns(manualTempo),
      meterBeatsPerBar,
      barOneSeconds,
    })
    .where(eq(table.id, id));
}
