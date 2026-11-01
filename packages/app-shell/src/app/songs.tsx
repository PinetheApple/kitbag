import { AllSongsScreen } from '@kitbag/tool-metronome';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function AllSongsRouteBody() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  return (
    <AllSongsScreen
      insets={insets}
      onBack={routes.back}
      onEditPreset={routes.openPreset}
      onLoaded={routes.toMetronome}
    />
  );
}

export default function AllSongsRoute() {
  return (
    <ToolGate toolId={TOOL_ID.metronome}>
      <AllSongsRouteBody />
    </ToolGate>
  );
}
