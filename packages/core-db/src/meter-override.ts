import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { songs, stemSets } from './schema';

export const GRID_METER = { triple: 3, quadruple: 4 } as const;
export type GridMeter = (typeof GRID_METER)[keyof typeof GRID_METER];
export const GRID_METERS: readonly GridMeter[] = Object.values(GRID_METER);

export interface MeterOverride {
  readonly meterBeatsPerBar: GridMeter | null;
  readonly barOneSeconds: number | null;
}

export type MeterOverridePatch = Partial<MeterOverride>;

export function isGridMeter(value: number | null): value is GridMeter {
  return GRID_METERS.some((meter) => meter === value);
}

export function storedMeter(value: number | null): GridMeter | null {
  return isGridMeter(value) ? value : null;
}

const validBarOne = (seconds: number) =>
  Number.isFinite(seconds) && seconds >= 0;

function checkedPatch(patch: MeterOverridePatch): MeterOverridePatch {
  const { meterBeatsPerBar, barOneSeconds } = patch;
  const meterSet = meterBeatsPerBar !== undefined && meterBeatsPerBar !== null;
  if (meterSet && !isGridMeter(meterBeatsPerBar))
    throw new RangeError(`Unsupported meter ${String(meterBeatsPerBar)}`);
  const barOneSet = barOneSeconds !== undefined && barOneSeconds !== null;
  if (barOneSet && !validBarOne(barOneSeconds))
    throw new RangeError(`Bar one out of range: ${String(barOneSeconds)}`);
  return {
    ...(meterBeatsPerBar === undefined ? {} : { meterBeatsPerBar }),
    ...(barOneSeconds === undefined ? {} : { barOneSeconds }),
  };
}

export async function saveSongMeterOverride(
  db: Database,
  id: number,
  patch: MeterOverridePatch,
): Promise<void> {
  const values = checkedPatch(patch);
  if (Object.keys(values).length === 0) return;
  await db.update(songs).set(values).where(eq(songs.id, id));
}

export async function saveStemSetMeterOverride(
  db: Database,
  id: number,
  patch: MeterOverridePatch,
): Promise<void> {
  const values = checkedPatch(patch);
  if (Object.keys(values).length === 0) return;
  await db.update(stemSets).set(values).where(eq(stemSets.id, id));
}
