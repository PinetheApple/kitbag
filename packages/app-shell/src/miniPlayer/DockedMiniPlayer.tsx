import { MiniPlayer } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export function DockedMiniPlayer({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const routes = useLibraryRoutes();
  return (
    <MiniPlayer
      usePlayhead={useMixerFrame}
      bottomInset={bottomInset}
      onOpenSong={routes.openSong}
    />
  );
}
