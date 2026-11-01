import { SetlistsScreen } from '@kitbag/tool-metronome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SetlistsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  return (
    <SetlistsScreen
      insets={insets}
      onBack={routes.back}
      onOpenSetlist={routes.openSetlist}
      onOpenAllSongs={routes.openAllSongs}
      onLoaded={routes.toMetronome}
    />
  );
}

export default gated(TOOL_ID.metronome, SetlistsRoute);
