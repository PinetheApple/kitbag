import { countLabel } from '@kitbag/core-design';
import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';

export interface ActiveSet {
  readonly name: string;
  readonly count: number;
  readonly position: number | undefined;
}

export const NO_ACTIVE_SET = 'Setlists';

export function activeSetOf(
  setlists: readonly SetlistSummary[],
  entries: Readonly<Record<number, readonly SetlistEntry[]>>,
  loadedItemId: number | null,
): ActiveSet | undefined {
  const active = setlists.find((summary) => summary.setlist.active);
  if (active === undefined) return undefined;
  const index = (entries[active.setlist.id] ?? []).findIndex(
    (entry) => entry.item.id === loadedItemId,
  );
  return {
    name: active.setlist.name,
    count: active.songCount,
    position: index < 0 ? undefined : index + 1,
  };
}

export function setlistChipLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return NO_ACTIVE_SET;
  if (set.position === undefined) {
    return `${set.name} · ${countLabel(set.count, 'song', 'songs')}`;
  }
  return `${set.name} · ${String(set.position)}/${String(set.count)}`;
}

export function setlistChipA11yLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return 'Setlists, none active';
  if (set.position === undefined) {
    return `Setlist ${set.name}, ${countLabel(set.count, 'song', 'songs')}`;
  }
  return `Setlist ${set.name}, song ${String(set.position)} of ${String(set.count)}`;
}
