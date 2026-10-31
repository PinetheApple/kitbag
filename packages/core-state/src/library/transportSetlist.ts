import type { TransportShowState } from '@kitbag/core-native';

import type { LibraryState } from './store.ts';

export type TransportSetlistPlace = TransportShowState['setlist'];

export function transportSetlistOf(
  state: Pick<LibraryState, 'loaded' | 'setlists' | 'entries'>,
): TransportSetlistPlace {
  const { loaded } = state;
  if (loaded?.setlistId == null) return null;
  const setlistId = loaded.setlistId;
  const summary = state.setlists.find((s) => s.setlist.id === setlistId);
  const entries = state.entries[setlistId] ?? [];
  const index = entries.findIndex((entry) => entry.item.id === loaded.itemId);
  const entry = entries[index];
  if (summary === undefined || entry === undefined) return null;
  return {
    setlistName: summary.setlist.name,
    songTitle: entry.preset.name,
    index,
    songCount: entries.length,
  };
}
