import { useNotice } from '@kitbag/core-design';
import type { PlayOrderRoutes } from '@kitbag/core-plugin-api';
import { useLiveStemPlayer } from '@kitbag/core-state';
import { useMemo } from 'react';


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
  const onNext = useLiveStemPlayer((s) => s.pressNext);
  const onPrevious = useLiveStemPlayer((s) => s.pressPrevious);
  return { onNext, onPrevious };
}
