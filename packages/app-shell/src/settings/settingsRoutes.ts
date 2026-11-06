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
      openCalibration: () => {
        router.push('/settings/calibrate');
      },
      openTools: () => {
        router.push('/settings/tools');
      },
      openRestore: () => {
        router.push('/settings/restore');
      },
    }),
    [router],
  );
}
