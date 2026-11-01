import { SetlistsScreen } from '@kitbag/tool-metronome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SetlistsRouteBody() {
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

export default function SetlistsRoute() {
  return (
    <ToolGate toolId={TOOL_ID.metronome}>
      <SetlistsRouteBody />
    </ToolGate>
  );
}
