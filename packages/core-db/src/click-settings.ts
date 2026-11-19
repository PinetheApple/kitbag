import { eq } from 'drizzle-orm';

import { CLICK_RATE, CLICK_RATES, type ClickRate } from './click-rate';
import { MAX_BEATS } from './preset-rules';
import type { Database } from './repository';
import { stemSets } from './schema';

// Mirrors KB_MAX_GRID_GROUPS, as preset-rules.ts mirrors its limits;
// engine-limits.test.ts fails if the two drift.
export const MAX_CLICK_GROUPS = 8;

export interface StemSetClick {
  readonly clickGrouping: readonly number[];
  readonly clickRate: ClickRate;
}

export type StemSetClickPatch = Partial<StemSetClick>;

export const NO_CLICK: StemSetClick = {
  clickGrouping: [],
  clickRate: CLICK_RATE.single,
};

export interface StemSetClickViolation {
  readonly field: keyof StemSetClick;
  readonly reason: string;
}

function isClickRate(value: unknown): value is ClickRate {
  return CLICK_RATES.some((rate) => rate === value);
}

export const groupBeats = (groups: readonly number[]) =>
  groups.reduce((total, size) => total + size, 0);

const isGroup = (size: unknown): size is number =>
  typeof size === 'number' && Number.isInteger(size) && size >= 1;

function groupingReason(groups: readonly unknown[]): string | null {
  if (groups.length > MAX_CLICK_GROUPS)
    return `More than ${String(MAX_CLICK_GROUPS)} groups`;
  if (!groups.every(isGroup))
    return `A group under one beat: ${String(groups)}`;
  const beats = groupBeats(groups);
  if (beats > MAX_BEATS)
    return `Groups sum to ${String(beats)} beats, over ${String(MAX_BEATS)}`;
  return null;
}

export function stemSetClickViolation(
  patch: StemSetClickPatch,
): StemSetClickViolation | null {
  const { clickGrouping, clickRate } = patch;
  const grouping =
    clickGrouping === undefined ? null : groupingReason(clickGrouping);
  if (grouping !== null) return { field: 'clickGrouping', reason: grouping };
  if (clickRate !== undefined && !isClickRate(clickRate))
    return { field: 'clickRate', reason: `Unknown rate ${String(clickRate)}` };
  return null;
}

function parsedGrouping(stored: string | null): readonly number[] {
  if (stored === null) return NO_CLICK.clickGrouping;
  try {
    const groups: unknown = JSON.parse(stored);
    const valid = Array.isArray(groups) && groupingReason(groups) === null;
    return valid ? (groups as number[]) : NO_CLICK.clickGrouping;
  } catch {
    return NO_CLICK.clickGrouping;
  }
}

export function stemSetClickOf(row: {
  readonly clickGrouping: string | null;
  readonly clickRate: string;
}): StemSetClick {
  return {
    clickGrouping: parsedGrouping(row.clickGrouping),
    clickRate: isClickRate(row.clickRate) ? row.clickRate : NO_CLICK.clickRate,
  };
}

function storedGrouping(groups: readonly number[]): string | null {
  return groups.length === 0 ? null : JSON.stringify(groups);
}

export async function saveStemSetClick(
  db: Database,
  id: number,
  patch: StemSetClickPatch,
): Promise<void> {
  const violation = stemSetClickViolation(patch);
  if (violation) throw new RangeError(violation.reason);
  const { clickGrouping, clickRate } = patch;
  const values = {
    ...(clickGrouping === undefined
      ? {}
      : { clickGrouping: storedGrouping(clickGrouping) }),
    ...(clickRate === undefined ? {} : { clickRate }),
  };
  if (Object.keys(values).length === 0) return;
  await db.update(stemSets).set(values).where(eq(stemSets.id, id));
}
