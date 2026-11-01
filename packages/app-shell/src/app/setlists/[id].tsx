import { SetlistDetailScreen } from '@kitbag/tool-metronome';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SetlistDetailRouteBody() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SetlistDetailScreen
      setlistId={Number(id)}
      insets={insets}
      onBack={routes.back}
      onEditPreset={routes.openPreset}
      onLoaded={routes.toMetronome}
    />
  );
}

export default function SetlistDetailRoute() {
  return (
    <ToolGate toolId={TOOL_ID.metronome}>
      <SetlistDetailRouteBody />
    </ToolGate>
  );
}
