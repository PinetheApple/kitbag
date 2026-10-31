import type { TransportSetlist } from '@kitbag/core-native';

import { activeSetlistOf } from './setlistPosition.ts';
import type { LibraryState } from './store.ts';

export function transportSetlistOf(
  state: Pick<LibraryState, 'loaded' | 'setlists' | 'entries'>,
): TransportSetlist | null {
  const { loaded } = state;
  const active = activeSetlistOf(state.setlists);
  if (loaded === null || active?.setlist.id !== loaded.setlistId) return null;
  const entries = state.entries[active.setlist.id] ?? [];
  const index = entries.findIndex((entry) => entry.item.id === loaded.itemId);
  const entry = entries[index];
  if (entry === undefined) return null;
  return {
    setlistName: active.setlist.name,
    songTitle: entry.preset.name,
    index,
    songCount: entries.length,
  };
}
