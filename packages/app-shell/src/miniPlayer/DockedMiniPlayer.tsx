import { MiniPlayer, useMiniPlayerShown } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { PlayAlongMiniPlayer } from '@kitbag/tool-sync';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { TOOL_ROUTES } from '@/home/toolRoutes';
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
  const router = useRouter();
  const song = useMiniPlayerShown();
  const openPlayAlong = useCallback(() => {
    router.push(TOOL_ROUTES.sync.home);
  }, [router]);
  if (!song)
    return (
      <PlayAlongMiniPlayer bottomInset={bottomInset} onOpen={openPlayAlong} />
    );
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
