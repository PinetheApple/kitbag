import { MiniPlayer, useMiniPlayerShown } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { PlayAlongMiniPlayer } from '@kitbag/tool-sync';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { TOOL_ID, TOOL_ROUTES } from '@/home/toolRoutes';
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
    router.push(TOOL_ROUTES.sync.home);
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
