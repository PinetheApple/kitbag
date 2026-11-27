import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DockedMiniPlayer } from './DockedMiniPlayer.tsx';
import { useSongMiniPlayerDocked } from './useMiniPlayerDocked.ts';

export function useViewedPlayerDock() {
  const { bottom } = useSafeAreaInsets();
  const docked = useSongMiniPlayerDocked();
  const render = useCallback(
    (onOpenQueue: () => void) => (
      <DockedMiniPlayer bottomInset={bottom} onOpenQueue={onOpenQueue} />
    ),
    [bottom],
  );
  return docked ? { renderMiniPlayer: render } : {};
}
