import { SongPlayerScreen } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { useIsFocused, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

interface SongRouteNavigation {
  readonly setParams: (params: { readonly id: string }) => void;
}

function SongPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const navigation = useNavigation<SongRouteNavigation>();
  const focused = useIsFocused();
  const { id } = useLocalSearchParams<{ id: string }>();
  const follow = useCallback(
    (songId: number) => {
      navigation.setParams({ id: String(songId) });
    },
    [navigation],
  );
  return (
    <SongPlayerScreen
      songId={Number(id)}
      focused={focused}
      insets={insets}
      onBack={routes.back}
      onOpenStemSet={routes.replaceStemSet}
      onOpenSong={follow}
      usePlayhead={useMixerFrame}
    />
  );
}

export default gated(TOOL_ID.library, SongPlayerRoute);
