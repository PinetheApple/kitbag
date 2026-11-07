import { SongPlayerScreen } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SongPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SongPlayerScreen
      songId={Number(id)}
      insets={insets}
      onBack={routes.back}
      usePlayhead={useMixerFrame}
    />
  );
}

export default gated(TOOL_ID.library, SongPlayerRoute);
