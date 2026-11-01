import { StemPlayerScreen } from '@kitbag/tool-stems';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { ToolGate } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function StemPlayerRouteBody() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <StemPlayerScreen setId={Number(id)} insets={insets} onBack={routes.back} />
  );
}

export default function StemPlayerRoute() {
  return (
    <ToolGate toolId={TOOL_ID.stems}>
      <StemPlayerRouteBody />
    </ToolGate>
  );
}
