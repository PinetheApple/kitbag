import type { TransportSetlist } from '@kitbag/core-native';

import { activeSetView } from './activeSet.ts';
import type { LibraryState } from './store.ts';

export function transportSetlistOf(
  state: Pick<LibraryState, 'loaded' | 'setlists' | 'entries'>,
): TransportSetlist | null {
  const set = activeSetView(state.setlists, state.entries, state.loaded);
  if (set?.position === undefined) return null;
  const song = state.entries[set.id]?.[set.position - 1]?.preset.name ?? '';
  return {
    subtitle: `${set.name} · ${song} (${String(set.position)}/${String(set.count)})`,
    index: set.position - 1,
    songCount: set.count,
  };
}
