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
      openAllSongs: () => {
        router.push('/songs');
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
