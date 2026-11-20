import { useCallback, useMemo } from 'react';
import { useStore } from 'zustand';

import {
  isPresetEntry,
  type LibrarySnapshot,
  type StemSetlistEntry,
} from './snapshot.ts';
import { libraryStore } from './store.ts';

const NO_SONG = 'No stem song to add';

export function setlistPicks(
  { setlists, entries }: Pick<LibrarySnapshot, 'setlists' | 'entries'>,
  stemSetId: number | null,
) {
  return setlists.map(({ setlist, songCount }) => {
    const stems = (entries[setlist.id] ?? []).filter(
      (entry): entry is StemSetlistEntry => !isPresetEntry(entry),
    );
    return {
      id: setlist.id,
      name: setlist.name,
      onStage: setlist.active,
      songCount,
      stemCount: stems.length,
      holds: stems.some((entry) => entry.stemSetId === stemSetId),
    };
  });
}

export function useSetlistPicker(stemSetId: number | null) {
  const setlists = useStore(libraryStore, (s) => s.setlists);
  const entries = useStore(libraryStore, (s) => s.entries);
  const refresh = useStore(libraryStore, (s) => s.refresh);
  const addStemToSetlist = useStore(libraryStore, (s) => s.addStemToSetlist);
  const onCreate = useStore(libraryStore, (s) => s.createSetlist);
  const picks = useMemo(
    () => setlistPicks({ setlists, entries }, stemSetId),
    [setlists, entries, stemSetId],
  );
  const onOpen = useCallback(() => {
    void refresh();
  }, [refresh]);
  const onAdd = useCallback(
    (setlistId: number) =>
      stemSetId === null
        ? Promise.reject(new Error(NO_SONG))
        : addStemToSetlist(setlistId, stemSetId),
    [addStemToSetlist, stemSetId],
  );
  return useMemo(
    () => ({ picks, onOpen, onAdd, onCreate }),
    [picks, onOpen, onAdd, onCreate],
  );
}
