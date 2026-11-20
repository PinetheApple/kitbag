import { StemPlayerScreen } from '@kitbag/tool-stems';
import { useIsFocused, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

interface StemRouteNavigation {
  readonly setParams: (params: { readonly id: string }) => void;
}

function StemPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const navigation = useNavigation<StemRouteNavigation>();
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const follow = useCallback(
    (stemSetId: number) => {
      navigation.setParams({ id: String(stemSetId) });
    },
    [navigation],
  );
  return (
    <StemPlayerScreen
      setId={Number(id)}
      focused={focused}
      insets={insets}
      onBack={routes.back}
      onOpenStemSet={follow}
      onOpenMetronome={routes.toMetronome}
      onOpenSetlist={routes.openSetlist}
    />
  );
}

export default gated(TOOL_ID.stems, StemPlayerRoute);
