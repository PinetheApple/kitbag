import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TOOL_ROUTE } from '@/home/toolRoutes';

import { useBackOrHome } from './backOrHome.ts';

export function useStemDeckRoutes() {
  const router = useRouter();
  const back = useBackOrHome();
  return useMemo(
    () => ({
      back,
      openConnect: () => {
        router.push(TOOL_ROUTE.stemDeck);
      },
      openCameraExplainer: () => {
        router.push(TOOL_ROUTE.stemDeckCamera);
      },
      openSongs: () => {
        router.push(TOOL_ROUTE.stemDeckSongs);
      },
      openImport: () => {
        router.push(TOOL_ROUTE.stemDeckImport);
      },
      // A cold start from the notification has no Stem songs below it to return to.
      openStemSongs: () => {
        router.dismissTo(TOOL_ROUTE.stems);
      },
    }),
    [router, back],
  );
}
