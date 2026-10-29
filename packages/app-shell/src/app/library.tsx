import { useLastTool } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

export default function SongsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const markUsed = useLastTool((s) => s.markUsed);

  useEffect(() => {
    markUsed(TOOL_ID.library);
  }, [markUsed]);

  return (
    <LibraryScreen
      view="songs"
      insets={insets}
      onBack={routes.back}
      onOpenStemSet={routes.openStemSet}
      onOpenSetlists={routes.openSetlists}
    />
  );
}
