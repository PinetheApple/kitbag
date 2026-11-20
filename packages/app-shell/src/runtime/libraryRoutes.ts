import { useRouter } from 'expo-router';
import { useMemo } from 'react';

export const ADD_STEM_SONGS = 'add';

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
      openStemSet: (id: number) => {
        router.navigate(`/stems/${String(id)}`);
      },
      openStemSongsToAdd: () => {
        router.push({ pathname: '/stems', params: { [ADD_STEM_SONGS]: '1' } });
      },
      openSong: (id: number) => {
        router.navigate(`/library/${String(id)}`);
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
    }),
    [router],
  );
}
