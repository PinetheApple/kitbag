import { useCallback, useMemo } from 'react';

import { usePlayerNotice } from './PlayerNotice.tsx';
import { usePlayOrderNav, type PlayOrderRoutes } from './usePlayOrderNav.ts';

export function usePlayerRoutes(
  onOpenStemSet: (stemSetId: number) => void,
  onOpenMetronome: () => void,
) {
  const notice = usePlayerNotice();
  const routes = useMemo<PlayOrderRoutes>(
    () => ({ onOpenStemSet, onOpenMetronome, onNotice: notice.showMessage }),
    [onOpenStemSet, onOpenMetronome, notice.showMessage],
  );
  const nav = usePlayOrderNav(routes);
  const skip = useCallback(() => {
    void nav.skip();
  }, [nav]);
  return { notice, routes, skip };
}
