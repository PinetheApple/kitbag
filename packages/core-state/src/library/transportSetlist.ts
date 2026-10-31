import type { TransportSetlist } from '@kitbag/core-native';

import { activeSetView, type ActiveSet } from './activeSet.ts';
import type { LibraryState } from './store.ts';

export function transportSetlistOf(
  setLabel: (set: ActiveSet) => string,
  state: Pick<LibraryState, 'loaded' | 'setlists' | 'entries'>,
): TransportSetlist | null {
  const set = activeSetView(state.setlists, state.entries, state.loaded);
  if (set === undefined) return null;
  if (set.position === undefined)
    return { subtitle: setLabel(set), index: null, songCount: set.count };
  const song = state.entries[set.id]?.[set.position - 1]?.preset.name ?? '';
  return {
    subtitle: `${set.name} · ${song} (${String(set.position)}/${String(set.count)})`,
    index: set.position - 1,
    songCount: set.count,
  };
}
