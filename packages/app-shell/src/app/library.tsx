import { useLastTool } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';
import { useToolOn } from '@/home/toolsOn';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SongsRouteBody() {
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
      {...(metronomeOn ? { onOpenSetlists: routes.openSetlists } : {})}
    />
  );
}

export default function SongsRoute() {
  return (
    <ToolGate toolId={TOOL_ID.library}>
      <SongsRouteBody />
    </ToolGate>
  );
}
