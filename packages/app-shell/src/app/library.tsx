import { useLastTool } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useToolOn } from '@/home/toolsOn';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SongsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const markUsed = useLastTool((s) => s.markUsed);
  const metronomeOn = useToolOn()(TOOL_ID.metronome);

  useEffect(() => {
    markUsed(TOOL_ID.library);
  }, [markUsed]);

  return (
    <LibraryScreen
      view="songs"
      insets={insets}
      onBack={routes.back}
      onOpenStemSet={routes.openStemSet}
      onOpenSong={routes.openSong}
      {...(metronomeOn ? { onOpenSetlists: routes.openSetlists } : {})}
    />
  );
}

export default gated(TOOL_ID.library, SongsRoute);
