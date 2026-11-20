import { useNotice } from '@kitbag/core-design';
import { useCallback, useMemo } from 'react';

import { usePlayOrderNav, type PlayOrderRoutes } from './usePlayOrderNav.ts';

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
  const nav = usePlayOrderNav(routes);
  const skip = useCallback(() => {
    void nav.skip();
  }, [nav]);
  return { notice, routes, skip };
}
