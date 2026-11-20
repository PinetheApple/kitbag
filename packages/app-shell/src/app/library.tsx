import { useLastTool } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryFolder } from '@/dataFolder/useLibraryFolder';
import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useToolOn } from '@/home/toolsOn';
import { DockedMiniPlayer } from '@/miniPlayer/DockedMiniPlayer';
import { useMiniPlayerDocked } from '@/miniPlayer/useMiniPlayerDocked';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SongsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const markUsed = useLastTool((s) => s.markUsed);
  const metronomeOn = useToolOn()(TOOL_ID.metronome);
  const docked = useMiniPlayerDocked();
  const folder = useLibraryFolder('songs');

  useEffect(() => {
    markUsed(TOOL_ID.library);
  }, [markUsed]);

  return (
    <>
      <LibraryScreen
        view="songs"
        insets={insets}
        onBack={routes.back}
        onOpenStemSet={routes.openStemSet}
        onOpenSong={routes.openSong}
        onOpenSetlist={routes.openSetlist}
        onUnavailable={folder.showUnavailable}
        strip={folder.strip}
        {...(metronomeOn ? { onOpenSetlists: routes.openSetlists } : {})}
        {...(docked
          ? { dock: <DockedMiniPlayer bottomInset={insets.bottom} /> }
          : {})}
      />
      {folder.sheet}
    </>
  );
}

export default gated(TOOL_ID.library, SongsRoute);
