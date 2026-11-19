import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { useBackOrHome } from './backOrHome.ts';

export function useStemDeckRoutes() {
  const router = useRouter();
  const back = useBackOrHome();
  return useMemo(
    () => ({
      back,
      openConnect: () => {
        router.push('/stemdeck');
      },
      openCameraExplainer: () => {
        router.push('/stemdeck/camera');
      },
      openSongs: () => {
        router.push('/stemdeck/songs');
      },
      openImport: () => {
        router.push('/stemdeck/import');
      },
      // A cold start from the notification has no Stem songs below it to return to.
      openStemSongs: () => {
        router.dismissTo('/stems');
      },
    }),
    [router, back],
  );
}
