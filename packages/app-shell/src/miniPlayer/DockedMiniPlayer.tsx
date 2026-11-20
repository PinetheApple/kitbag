import { MiniPlayer } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export interface DockedMiniPlayerProps {
  readonly bottomInset: number;
  readonly onOpenQueue: () => void;
}

export function DockedMiniPlayer({
  bottomInset,
  onOpenQueue,
}: DockedMiniPlayerProps) {
  const routes = useLibraryRoutes();
  return (
    <MiniPlayer
      usePlayhead={useMixerFrame}
      bottomInset={bottomInset}
      onOpenSong={routes.openSong}
      onOpenStemSet={routes.openStemSet}
      onOpenQueue={onOpenQueue}
    />
  );
}
