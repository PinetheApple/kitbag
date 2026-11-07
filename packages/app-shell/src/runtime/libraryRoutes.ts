import { useRouter } from 'expo-router';
import { useMemo } from 'react';

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
      openSong: (id: number) => {
        router.navigate(`/library/${String(id)}`);
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
