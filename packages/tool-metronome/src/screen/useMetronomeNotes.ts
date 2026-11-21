import { useLibrary } from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

import { noteStrip, type NoteStrip } from '../logic/noteStrip.ts';

export function useNoteStrip(): NoteStrip | null {
  const songLoaded = useLibrary((state) => state.loaded !== null);
  const notes = useLibrary((state) => {
    const loadedId = state.loaded?.presetId;
    if (loadedId === undefined) return null;
    return (
      state.presets.find((preset) => preset.id === loadedId)?.notes ?? null
    );
  });
  return useMemo(() => noteStrip(songLoaded, notes), [songLoaded, notes]);
}

export function useSkippedNotice() {
  const [shownAt, setShownAt] = useState<number | null>(null);
  const show = useCallback(() => {
    setShownAt(Date.now());
  }, []);
  const hide = useCallback(() => {
    setShownAt(null);
  }, []);
  return { shownAt, show, hide };
}
