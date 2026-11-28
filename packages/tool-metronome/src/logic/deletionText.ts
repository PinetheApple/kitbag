import { deletedText, removedText } from '@kitbag/core-design';
import {
  stemSongTitle,
  type LibraryDeletion,
  type SetlistItem,
  type SetlistSummary,
  type SongPreset,
  type StemSongs,
} from '@kitbag/core-state';

export interface DeletionNames {
  readonly presets: readonly SongPreset[];
  readonly setlists: readonly SetlistSummary[];
  readonly stems: StemSongs;
}

export function removedFromText(name: string, setName: string): string {
  return `${removedText(name)} from ${setName}`;
}

function entryName(item: SetlistItem, names: DeletionNames): string {
  const { songPresetId, stemSetId } = item;
  if (songPresetId !== null)
    return names.presets.find((p) => p.id === songPresetId)?.name ?? '';
  return stemSetId === null ? '' : stemSongTitle(stemSetId, names.stems);
}

export function deletionText(
  deletion: LibraryDeletion,
  names: DeletionNames,
): string {
  if (deletion.kind === 'setlist')
    return deletedText(deletion.deleted.setlist.name);
  if (deletion.kind === 'song')
    return deletedText(deletion.deleted.preset.name);
  const { item } = deletion.removed;
  const set = names.setlists.find((s) => s.setlist.id === item.setlistId);
  return removedFromText(entryName(item, names), set?.setlist.name ?? '');
}
