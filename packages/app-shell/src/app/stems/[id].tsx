import { StemPlayerScreen } from '@kitbag/tool-stems';
import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function StemPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <StemPlayerScreen
      setId={Number(id)}
      focused={focused}
      insets={insets}
      onBack={routes.back}
    />
  );
}

export default gated(TOOL_ID.stems, StemPlayerRoute);
