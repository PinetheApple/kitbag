import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import type { songs, stemSets } from './schema';

export const GRID_METER = { triple: 3, quadruple: 4 } as const;
export type GridMeter = (typeof GRID_METER)[keyof typeof GRID_METER];
export const GRID_METERS: readonly GridMeter[] = Object.values(GRID_METER);

export interface MeterOverride {
  readonly meterBeatsPerBar: GridMeter | null;
  readonly barOneSeconds: number | null;
}

export type MeterOverridePatch = Partial<MeterOverride>;

export const NO_METER_OVERRIDE: MeterOverride = {
  meterBeatsPerBar: null,
  barOneSeconds: null,
};

function isGridMeter(value: number | null): value is GridMeter {
  return GRID_METERS.some((meter) => meter === value);
}

function storedMeter(value: number | null): GridMeter | null {
  return isGridMeter(value) ? value : null;
}

const validBarOne = (seconds: number) =>
  Number.isFinite(seconds) && seconds >= 0;

export interface MeterOverrideViolation {
  field: keyof MeterOverride;
  reason: string;
}

export function meterOverrideViolation(patch: {
  readonly meterBeatsPerBar?: number | null;
  readonly barOneSeconds?: number | null;
}): MeterOverrideViolation | null {
  const { meterBeatsPerBar, barOneSeconds } = patch;
  const hasMeter = meterBeatsPerBar !== undefined && meterBeatsPerBar !== null;
  if (hasMeter && !isGridMeter(meterBeatsPerBar))
    return {
      field: 'meterBeatsPerBar',
      reason: `Unsupported meter ${String(meterBeatsPerBar)}`,
    };
  const hasBarOne = barOneSeconds !== undefined && barOneSeconds !== null;
  if (hasBarOne && !validBarOne(barOneSeconds))
    return {
      field: 'barOneSeconds',
      reason: `Bar one out of range: ${String(barOneSeconds)}`,
    };
  return null;
}

function checkedPatch(patch: MeterOverridePatch): MeterOverridePatch {
  const violation = meterOverrideViolation(patch);
  if (violation) throw new RangeError(violation.reason);
  const { meterBeatsPerBar, barOneSeconds } = patch;
  return {
    ...(meterBeatsPerBar === undefined ? {} : { meterBeatsPerBar }),
    ...(barOneSeconds === undefined ? {} : { barOneSeconds }),
  };
}

export function meterOverrideOf(row: {
  readonly meterBeatsPerBar: number | null;
  readonly barOneSeconds: number | null;
}): MeterOverride {
  return {
    meterBeatsPerBar: storedMeter(row.meterBeatsPerBar),
    barOneSeconds: row.barOneSeconds,
  };
}

export async function saveMeterOverride(
  db: Database,
  table: typeof songs | typeof stemSets,
  id: number,
  patch: MeterOverridePatch,
): Promise<void> {
  const values = checkedPatch(patch);
  if (Object.keys(values).length === 0) return;
  await db.update(table).set(values).where(eq(table.id, id));
}
