import { useLibrary } from '@kitbag/core-state';
import { useMemo } from 'react';

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
