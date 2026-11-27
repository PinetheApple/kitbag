import { ROW_TAP, type RowTap } from '@kitbag/core-state';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TOOL_ROUTE } from '@/home/toolRoutes';

export const ADD_STEM_SONGS = 'add';
export const VIEW_SONG = 'view';

export interface FollowParams {
  readonly id: string;
  readonly [VIEW_SONG]: undefined;
}

export const followParams = (id: number): FollowParams => ({
  id: String(id),
  [VIEW_SONG]: undefined,
});

const viewParams = (id: number) => ({ id: String(id), [VIEW_SONG]: '1' });

export function useLibraryRoutes() {
  const router = useRouter();
  return useMemo(
    () => ({
      back: () => {
        router.back();
      },
      openSetlist: (id: number) => {
        router.push(`${TOOL_ROUTE.setlists}/${String(id)}`);
      },
      openSetlists: () => {
        router.push(TOOL_ROUTE.setlists);
      },
      openAllSongs: () => {
        router.push(TOOL_ROUTE.allSongs);
      },
      // Unlike push, navigate keeps one screen when a double tap repeats the id.
      openStemSet: (id: number, tap?: RowTap) => {
        if (tap === ROW_TAP.view)
          router.navigate({
            pathname: TOOL_ROUTE.stemSet,
            params: viewParams(id),
          });
        else router.navigate(`${TOOL_ROUTE.stems}/${String(id)}`);
      },
      openStemSongsToAdd: () => {
        router.push({
          pathname: TOOL_ROUTE.stems,
          params: { [ADD_STEM_SONGS]: '1' },
        });
      },
      openSong: (id: number, tap?: RowTap) => {
        if (tap === ROW_TAP.view)
          router.navigate({
            pathname: TOOL_ROUTE.song,
            params: viewParams(id),
          });
        else router.navigate(`${TOOL_ROUTE.library}/${String(id)}`);
      },
      // A player the queue hands over from must not stay under the next one: Back would reopen its song.
      replaceSong: (id: number) => {
        router.replace(`${TOOL_ROUTE.library}/${String(id)}`);
      },
      replaceStemSet: (id: number) => {
        router.replace(`${TOOL_ROUTE.stems}/${String(id)}`);
      },
      openPreset: (id: number) => {
        router.push({
          pathname: TOOL_ROUTE.preset,
          params: { id: String(id) },
        });
      },
      replacePreset: (id: number) => {
        router.replace({
          pathname: TOOL_ROUTE.preset,
          params: { id: String(id) },
        });
      },
      toMetronome: () => {
        router.dismissTo(TOOL_ROUTE.metronome);
      },
      openMetronome: () => {
        router.navigate(TOOL_ROUTE.metronome);
      },
    }),
    [router],
  );
}
