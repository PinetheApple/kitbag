import type { TransportSetlist } from '@kitbag/core-native';

import { activeSetView, type ActiveSet } from './activeSet.ts';
import { isPresetEntry } from './snapshot.ts';
import type { LibraryState } from './store.ts';

export function transportSetlistOf(
  subtitleOf: (set: ActiveSet, song: string | undefined) => string,
  state: Pick<LibraryState, 'loaded' | 'setlists' | 'entries'>,
): TransportSetlist | null {
  const set = activeSetView(state.setlists, state.entries, state.loaded);
  if (set === undefined) return null;
  const index = set.position === undefined ? null : set.position - 1;
  const entry = index === null ? undefined : state.entries[set.id]?.[index];
  const song =
    entry !== undefined && isPresetEntry(entry) ? entry.preset.name : undefined;
  return { subtitle: subtitleOf(set, song) };
}
