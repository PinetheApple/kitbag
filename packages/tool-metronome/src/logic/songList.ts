import { countLabel } from '@kitbag/core-design';
import {
  isPresetEntry,
  type ActiveSet,
  type SetlistEntry,
} from '@kitbag/core-state';

export interface SongListRow {
  readonly itemId: number;
  readonly presetId: number;
  readonly number: string;
  readonly name: string;
  readonly bpm: string;
  readonly now: boolean;
}

export function songListHint(set: ActiveSet): string {
  const where =
    set.position === undefined
      ? countLabel(set.count, 'song', 'songs')
      : `song ${String(set.position)} of ${String(set.count)}`;
  return `On stage · ${where} · tap a song to load it`;
}

export function songListRows(
  entries: readonly SetlistEntry[],
  loadedItemId: number | null,
): SongListRow[] {
  return entries.flatMap((entry, index) => {
    if (!isPresetEntry(entry)) return [];
    const { item, preset } = entry;
    return [
      {
        itemId: item.id,
        presetId: preset.id,
        number: String(index + 1),
        name: preset.name,
        bpm: String(Math.round(preset.bpm)),
        now: item.id === loadedItemId,
      },
    ];
  });
}
