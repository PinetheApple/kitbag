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
      openStemSet: (id: number) => {
        router.push(`/stems/${String(id)}`);
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
