import type { Setlist, SetlistItem, SongPreset } from '@kitbag/core-db';

import type { LibraryRepositories } from './runtime.ts';

export interface SetlistEntry {
  readonly item: SetlistItem;
  readonly preset: SongPreset;
}

export interface SetlistSummary {
  readonly setlist: Setlist;
  readonly songCount: number;
  readonly rampCount: number;
}

export interface LibrarySnapshot {
  readonly setlists: readonly SetlistSummary[];
  readonly entries: Readonly<Record<number, readonly SetlistEntry[]>>;
  readonly presets: readonly SongPreset[];
  readonly standalone: readonly SongPreset[];
}

async function entriesOf(
  repos: LibraryRepositories,
  setlist: Setlist,
  byId: ReadonlyMap<number, SongPreset>,
): Promise<SetlistEntry[]> {
  const items = await repos.setlists.items(setlist.id);
  return items.flatMap((item) => {
    const preset = byId.get(item.songPresetId);
    return preset === undefined ? [] : [{ item, preset }];
  });
}

function summarise(
  setlist: Setlist,
  entries: readonly SetlistEntry[],
): SetlistSummary {
  const rampCount = entries.filter((e) => e.preset.rampEnabled).length;
  return { setlist, songCount: entries.length, rampCount };
}

function activeFirst(a: SetlistSummary, b: SetlistSummary): number {
  return Number(b.setlist.active) - Number(a.setlist.active);
}

export async function takeSnapshot(
  repos: LibraryRepositories,
): Promise<LibrarySnapshot> {
  const [setlists, presets] = await Promise.all([
    repos.setlists.list(),
    repos.presets.list(),
  ]);
  const byId = new Map(presets.map((preset) => [preset.id, preset]));
  const entries: Record<number, SetlistEntry[]> = {};
  for (const setlist of setlists) {
    entries[setlist.id] = await entriesOf(repos, setlist, byId);
  }
  const listed = new Set(
    Object.values(entries).flatMap((list) => list.map((e) => e.preset.id)),
  );
  return {
    setlists: setlists
      .map((setlist) => summarise(setlist, entries[setlist.id] ?? []))
      .sort(activeFirst),
    entries,
    presets,
    standalone: presets.filter((preset) => !listed.has(preset.id)),
  };
}
