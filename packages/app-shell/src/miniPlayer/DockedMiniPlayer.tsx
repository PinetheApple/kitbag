import { MiniPlayer, useMiniPlayerShown } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { PlayAlongMiniPlayer } from '@kitbag/tool-sync';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { PLAY_ALONG_ROUTE } from '@/home/registry';
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
    router.push(PLAY_ALONG_ROUTE);
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
