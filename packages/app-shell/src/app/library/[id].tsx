import { useLiveSongPlayer } from '@kitbag/core-state';
import {
  SongPlayerScreen,
  type SongPlayerScreenProps,
} from '@kitbag/tool-library';
import { UpNextRow, useMixerFrame } from '@kitbag/tool-stems';
import { useIsFocused, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useQueueSheet } from '@/queue/useQueueSheet';
import { useViewedPlayerDock } from '@/miniPlayer/useViewedPlayerDock';
import {
  followParams,
  useLibraryRoutes,
  VIEW_SONG,
  type FollowParams,
} from '@/runtime/libraryRoutes';

interface SongRouteNavigation {
  readonly setParams: (params: FollowParams) => void;
}

type RenderUpNext = NonNullable<SongPlayerScreenProps['renderUpNext']>;

function useSongUpNext(bottomInset: number, onOpenSong: (id: number) => void) {
  const routes = useLibraryRoutes();
  const place = useMemo(
    () => ({
      playsInPlace: false,
      routes: { onOpenStemSet: routes.replaceStemSet, onOpenSong },
    }),
    [routes.replaceStemSet, onOpenSong],
  );
  const queue = useQueueSheet(bottomInset, place);
  const pressNext = useLiveSongPlayer((s) => s.pressNext);
  const pressPrevious = useLiveSongPlayer((s) => s.pressPrevious);
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
  return { renderUpNext, openQueue: queue.open, sheet: queue.sheet };
}

function SongPlayerRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const navigation = useNavigation<SongRouteNavigation>();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{
    id: string;
    [VIEW_SONG]?: string;
  }>();
  const dock = useViewedPlayerDock();
  const follow = useCallback(
    (songId: number) => {
      navigation.setParams(followParams(songId));
    },
    [navigation],
  );
  const upNext = useSongUpNext(insets.bottom, follow);
  return (
    <>
      <SongPlayerScreen
        songId={Number(params.id)}
        view={params[VIEW_SONG] !== undefined}
        focused={focused}
        insets={insets}
        onBack={routes.back}
        onOpenStemSet={routes.replaceStemSet}
        onOpenSong={follow}
        usePlayhead={useMixerFrame}
        renderUpNext={upNext.renderUpNext}
        onOpenQueue={upNext.openQueue}
        onOpenSetlist={routes.openSetlist}
        {...dock}
      />
      {upNext.sheet}
    </>
  );
}

export default gated(TOOL_ID.library, SongPlayerRoute);
