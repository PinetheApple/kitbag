import { ROW_TAP, type RowTap } from '@kitbag/core-state';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TOOL_ROUTES, withId } from '@/home/toolRoutes';

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
        router.push(withId(TOOL_ROUTES.metronome.setlist, id));
      },
      openSetlists: () => {
        router.push(TOOL_ROUTES.metronome.setlists);
      },
      openAllSongs: () => {
        router.push(TOOL_ROUTES.metronome.allSongs);
      },
      // Unlike push, navigate keeps one screen when a double tap repeats the id.
      openStemSet: (id: number, tap?: RowTap) => {
        if (tap === ROW_TAP.view)
          router.navigate({
            pathname: TOOL_ROUTES.stems.stemSet,
            params: viewParams(id),
          });
        else router.navigate(withId(TOOL_ROUTES.stems.stemSet, id));
      },
      openStemSongsToAdd: () => {
        router.push({
          pathname: TOOL_ROUTES.stems.home,
          params: { [ADD_STEM_SONGS]: '1' },
        });
      },
      openSong: (id: number, tap?: RowTap) => {
        if (tap === ROW_TAP.view)
          router.navigate({
            pathname: TOOL_ROUTES.library.song,
            params: viewParams(id),
          });
        else router.navigate(withId(TOOL_ROUTES.library.song, id));
      },
      // A player the queue hands over from must not stay under the next one: Back would reopen its song.
      replaceSong: (id: number) => {
        router.replace(withId(TOOL_ROUTES.library.song, id));
      },
      replaceStemSet: (id: number) => {
        router.replace(withId(TOOL_ROUTES.stems.stemSet, id));
      },
      openPreset: (id: number) => {
        router.push(withId(TOOL_ROUTES.metronome.preset, id));
      },
      replacePreset: (id: number) => {
        router.replace(withId(TOOL_ROUTES.metronome.preset, id));
      },
      toMetronome: () => {
        router.dismissTo(TOOL_ROUTES.metronome.home);
      },
      openMetronome: () => {
        router.navigate(TOOL_ROUTES.metronome.home);
      },
    }),
    [router],
  );
}
