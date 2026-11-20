import { useNotice } from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useMemo } from 'react';

import type { PlayOrderRoutes } from './usePlayOrderNav.ts';

export function usePlayerRoutes(
  onOpenStemSet: (stemSetId: number) => void,
  onOpenSong: (songId: number) => void,
  onOpenMetronome: () => void,
) {
  const notice = useNotice();
  const skip = useStemPlayer((s) => s.pressNext);
  const back = useStemPlayer((s) => s.pressPrevious);
  const routes = useMemo<PlayOrderRoutes>(
    () => ({
      onOpenStemSet,
      onOpenSong,
      onOpenMetronome,
      onNotice: notice.showMessage,
    }),
    [onOpenStemSet, onOpenSong, onOpenMetronome, notice.showMessage],
  );
  return { notice, routes, skip, back };
}
