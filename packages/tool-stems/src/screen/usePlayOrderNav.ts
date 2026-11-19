import {
  ADVANCE,
  isPresetEntry,
  SKIPPED_STEM_SONG,
  usePlayOrder,
  useLibrary,
  useStage,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef } from 'react';

export interface PlayOrderRoutes {
  readonly onOpenStemSet: (stemSetId: number) => void;
  readonly onOpenMetronome: () => void;
  readonly onNotice: (message: string) => void;
}

export type Leave =
  | { readonly kind: 'stem'; readonly stemSetId: number }
  | { readonly kind: 'metronome' };

export function leaveOf(entry: SetlistEntry): Leave {
  return isPresetEntry(entry)
    ? { kind: 'metronome' }
    : { kind: 'stem', stemSetId: entry.stemSetId };
}

export function useLeaveAfterClose(routes: PlayOrderRoutes) {
  const leaving = useRef<Leave | null>(null);
  const leaveFor = useCallback((leave: Leave) => {
    leaving.current = leave;
  }, []);
  const closed = useCallback(() => {
    const leave = leaving.current;
    leaving.current = null;
    if (leave === null) return;
    if (leave.kind === 'stem') routes.onOpenStemSet(leave.stemSetId);
    else routes.onOpenMetronome();
  }, [routes]);
  return { leaveFor, closed };
}

export function usePlayOrderNav(routes: PlayOrderRoutes) {
  const skipToNext = usePlayOrder((s) => s.skipToNext);
  const playQueued = usePlayOrder((s) => s.playQueued);
  const loadSong = useLibrary((s) => s.loadSong);
  const openStemEntry = useLibrary((s) => s.openStemEntry);
  const { stage } = useStage();
  const { setlistId } = stage;
  const openEntry = useCallback(
    async (entry: SetlistEntry) => {
      if (setlistId === null) return;
      if (isPresetEntry(entry))
        await loadSong(entry.preset.id, entry.item.id, setlistId);
      else await openStemEntry(entry.item.id, setlistId);
    },
    [setlistId, openStemEntry, loadSong],
  );
  const skip = useCallback(async () => {
    const { advance, skipped } = await skipToNext();
    if (skipped) routes.onNotice(SKIPPED_STEM_SONG);
    if (advance.kind === ADVANCE.play) routes.onOpenStemSet(advance.stemSetId);
    if (advance.kind !== ADVANCE.open) return;
    await openEntry(advance.entry);
    routes.onOpenMetronome();
  }, [skipToNext, routes, openEntry]);
  const playNow = useCallback(
    (stemSetId: number) => playQueued(stemSetId),
    [playQueued],
  );
  return useMemo(
    () => ({ skip, playNow, openEntry }),
    [skip, playNow, openEntry],
  );
}
