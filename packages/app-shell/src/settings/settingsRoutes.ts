import { useRouter } from 'expo-router';
import { useMemo } from 'react';

export function useSettingsRoutes() {
  const router = useRouter();
  return useMemo(
    () => ({
      back: () => {
        router.back();
      },
      openSettings: () => {
        router.push('/settings');
      },
      openAttributions: () => {
        router.push('/settings/attributions');
      },
    }),
    [router],
  );
}
