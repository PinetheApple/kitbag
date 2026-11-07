import { useSongPlayer } from '@kitbag/core-state';
import { SONG_WAVE_BARS, SongPlayerScreen } from '@kitbag/tool-library';
import { useMixerFrame } from '@kitbag/tool-stems';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

function SongPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const { id } = useLocalSearchParams<{ id: string }>();
  const open = useSongPlayer((s) => s.open);
  const close = useSongPlayer((s) => s.close);

  useEffect(() => {
    void open(Number(id), SONG_WAVE_BARS);
    return close;
  }, [open, close, id]);

  return (
    <SongPlayerScreen
      insets={insets}
      onBack={routes.back}
      useFrame={useMixerFrame}
    />
  );
}

export default gated(TOOL_ID.library, SongPlayerRoute);
