import { activeSetlistOf } from './setlistPosition.ts';
import type { SetlistEntry, SetlistSummary } from './snapshot.ts';
import type { LoadedSong } from './store.ts';

export interface ActiveSet {
  readonly id: number;
  readonly name: string;
  readonly count: number;
  readonly position: number | undefined;
}

export function activeSetView(
  setlists: readonly SetlistSummary[],
  entries: Readonly<Record<number, readonly SetlistEntry[]>>,
  loaded: LoadedSong | null,
): ActiveSet | undefined {
  const active = activeSetlistOf(setlists);
  if (active === undefined) return undefined;
  const id = active.setlist.id;
  if (loaded !== null && loaded.setlistId !== id) return undefined;
  const index = (entries[id] ?? []).findIndex(
    (entry) => entry.item.id === loaded?.itemId,
  );
  return {
    id,
    name: active.setlist.name,
    count: active.songCount,
    position: index < 0 ? undefined : index + 1,
  };
}
