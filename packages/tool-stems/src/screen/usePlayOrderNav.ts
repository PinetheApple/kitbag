import {
  ADVANCE,
  isPresetEntry,
  SKIPPED_STEM_SONG,
  usePlayOrder,
  type SetlistEntry,
} from '@kitbag/core-state';
import { useAfterSheetClosed } from '@kitbag/core-design';
import { useCallback, useMemo } from 'react';

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

export function useLeaveAfterClose(routes: PlayOrderRoutes, visible: boolean) {
  const { after, closed } = useAfterSheetClosed(visible);
  const leaveFor = useCallback(
    (leave: Leave) => {
      after(() => {
        if (leave.kind === 'stem') routes.onOpenStemSet(leave.stemSetId);
        else routes.onOpenMetronome();
      });
    },
    [after, routes],
  );
  return { leaveFor, closed };
}

export function usePlayOrderNav(routes: PlayOrderRoutes) {
  const skipToNext = usePlayOrder((s) => s.skipToNext);
  const openEntry = usePlayOrder((s) => s.openEntry);
  const skip = useCallback(async () => {
    const { advance, skipped } = await skipToNext();
    if (skipped) routes.onNotice(SKIPPED_STEM_SONG);
    if (advance.kind === ADVANCE.play) routes.onOpenStemSet(advance.stemSetId);
    if (advance.kind !== ADVANCE.open) return;
    await openEntry(advance.entry);
    routes.onOpenMetronome();
  }, [skipToNext, routes, openEntry]);
  return useMemo(() => ({ skip, openEntry }), [skip, openEntry]);
}
