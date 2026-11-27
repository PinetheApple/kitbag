import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TOOL_ROUTES } from '@/home/toolRoutes';

import { useBackOrHome } from './backOrHome.ts';

export function useStemDeckRoutes() {
  const router = useRouter();
  const back = useBackOrHome();
  return useMemo(
    () => ({
      back,
      openConnect: () => {
        router.push(TOOL_ROUTES.stems.stemDeck);
      },
      openCameraExplainer: () => {
        router.push(TOOL_ROUTES.stems.stemDeckCamera);
      },
      openSongs: () => {
        router.push(TOOL_ROUTES.stems.stemDeckSongs);
      },
      openImport: () => {
        router.push(TOOL_ROUTES.stems.stemDeckImport);
      },
      // A cold start from the notification has no Stem songs below it to return to.
      openStemSongs: () => {
        router.dismissTo(TOOL_ROUTES.stems.home);
      },
    }),
    [router, back],
  );
}
