import { useSongPlayer } from '@kitbag/core-state';
import { SongPlayerScreen, type SongPlayerScreenProps } from '@kitbag/tool-library';
import { UpNextRow, useMixerFrame } from '@kitbag/tool-stems';
import { useIsFocused, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useQueueSheet } from '@/queue/useQueueSheet';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';

interface SongRouteNavigation {
  readonly setParams: (params: { readonly id: string }) => void;
}

type RenderUpNext = NonNullable<SongPlayerScreenProps['renderUpNext']>;

function useSongUpNext(bottomInset: number, onOpenSong: (id: number) => void) {
  const routes = useLibraryRoutes();
  const player = useMemo(
    () => ({ onOpenStemSet: routes.replaceStemSet, onOpenSong }),
    [routes.replaceStemSet, onOpenSong],
  );
  const queue = useQueueSheet(bottomInset, player);
  const pressNext = useSongPlayer((s) => s.pressNext);
  const pressPrevious = useSongPlayer((s) => s.pressPrevious);
  const renderUpNext = useCallback<RenderUpNext>(
    (songSec) => (
      <UpNextRow
        songSec={songSec}
        onOpenSheet={queue.open}
        onNext={pressNext}
        onPrevious={pressPrevious}
      />
    ),
    [queue.open, pressNext, pressPrevious],
  );
  return { renderUpNext, sheet: queue.sheet };
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
  const upNext = useSongUpNext(insets.bottom, follow);
  return (
    <>
      <SongPlayerScreen
        songId={Number(id)}
        focused={focused}
        insets={insets}
        onBack={routes.back}
        onOpenStemSet={routes.replaceStemSet}
        onOpenSong={follow}
        usePlayhead={useMixerFrame}
        renderUpNext={upNext.renderUpNext}
      />
      {upNext.sheet}
    </>
  );
}

export default gated(TOOL_ID.library, SongPlayerRoute);
