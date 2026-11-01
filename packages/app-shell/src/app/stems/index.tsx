import { useLastTool } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function StemSongsRouteBody() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const markUsed = useLastTool((s) => s.markUsed);

  useEffect(() => {
    markUsed(TOOL_ID.stems);
  }, [markUsed]);

  return (
    <LibraryScreen
      view="stems"
      insets={insets}
      onBack={routes.back}
      onOpenStemSet={routes.openStemSet}
    />
  );
}

export default function StemSongsRoute() {
  return (
    <ToolGate toolId={TOOL_ID.stems}>
      <StemSongsRouteBody />
    </ToolGate>
  );
}
