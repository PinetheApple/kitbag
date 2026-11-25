import { ROW_TAP, type RowTap } from '@kitbag/core-state';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';

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
        router.push(`/setlists/${String(id)}`);
      },
      openSetlists: () => {
        router.push('/setlists');
      },
      openAllSongs: () => {
        router.push('/songs');
      },
      // Unlike push, navigate keeps one screen when a double tap repeats the id.
      openStemSet: (id: number, tap?: RowTap) => {
        if (tap === ROW_TAP.view)
          router.navigate({ pathname: '/stems/[id]', params: viewParams(id) });
        else router.navigate(`/stems/${String(id)}`);
      },
      openStemSongsToAdd: () => {
        router.push({ pathname: '/stems', params: { [ADD_STEM_SONGS]: '1' } });
      },
      openSong: (id: number, tap?: RowTap) => {
        if (tap === ROW_TAP.view)
          router.navigate({
            pathname: '/library/[id]',
            params: viewParams(id),
          });
        else router.navigate(`/library/${String(id)}`);
      },
      // A player the queue hands over from must not stay under the next one: Back would reopen its song.
      replaceSong: (id: number) => {
        router.replace(`/library/${String(id)}`);
      },
      replaceStemSet: (id: number) => {
        router.replace(`/stems/${String(id)}`);
      },
      openPreset: (id: number) => {
        router.push(`/presets/${String(id)}`);
      },
      replacePreset: (id: number) => {
        router.replace(`/presets/${String(id)}`);
      },
      toMetronome: () => {
        router.dismissTo('/metronome');
      },
      openMetronome: () => {
        router.navigate('/metronome');
      },
    }),
    [router],
  );
}
