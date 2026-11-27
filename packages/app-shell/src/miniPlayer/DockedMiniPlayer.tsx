import { MiniPlayer, useMiniPlayerShown } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { PlayAlongMiniPlayer } from '@kitbag/tool-sync';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { PLAY_ALONG_ROUTE, TOOL_ID } from '@/home/registry';
import { useToolOn } from '@/home/toolsOn';
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
  const playAlongOn = useToolOn()(TOOL_ID.sync);
  const openPlayAlong = useCallback(() => {
    router.push(PLAY_ALONG_ROUTE);
  }, [router]);
  if (song)
    return (
      <MiniPlayer
        usePlayhead={useMixerFrame}
        bottomInset={bottomInset}
        onOpenSong={routes.openSong}
        onOpenStemSet={routes.openStemSet}
        onOpenQueue={onOpenQueue}
      />
    );
  if (!playAlongOn) return null;
  return (
    <PlayAlongMiniPlayer bottomInset={bottomInset} onOpen={openPlayAlong} />
  );
}
