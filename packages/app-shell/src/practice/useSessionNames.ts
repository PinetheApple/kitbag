import { useLibrary } from '@kitbag/core-state';
import { useMemo } from 'react';

import type { SessionNames } from './historyText.ts';

export function useSessionNames(): SessionNames {
  const presets = useLibrary((s) => s.presets);
  const setlists = useLibrary((s) => s.setlists);
  return useMemo(() => {
    const songs = new Map(presets.map((p) => [p.uuid, p.name]));
    const sets = new Map(setlists.map((s) => [s.setlist.id, s.setlist.name]));
    return {
      song: (uuid: string) => songs.get(uuid),
      setlist: (setlistId: number) => sets.get(setlistId),
    };
  }, [presets, setlists]);
}
