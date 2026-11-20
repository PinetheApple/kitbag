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
  const routes = useMemo<PlayOrderRoutes>(
    () => ({
      onOpenStemSet,
      onOpenSong,
      onOpenMetronome,
      onNotice: notice.showMessage,
    }),
    [onOpenStemSet, onOpenSong, onOpenMetronome, notice.showMessage],
  );
  return { notice, routes };
}

export function useStemPresses() {
  const onNext = useStemPlayer((s) => s.pressNext);
  const onPrevious = useStemPlayer((s) => s.pressPrevious);
  return { onNext, onPrevious };
}
