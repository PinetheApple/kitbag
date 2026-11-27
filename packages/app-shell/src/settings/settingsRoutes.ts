import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TOOL_ROUTES } from '@/home/toolRoutes';

export const SHEET_PARAM = 'sheet';
export const DATA_FOLDER_SHEET = 'dataFolder';
export const RESTORE_ROUTE = '/settings/restore';

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
      openDataFolder: () => {
        router.push({
          pathname: '/settings',
          params: { [SHEET_PARAM]: DATA_FOLDER_SHEET },
        });
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
        router.push(RESTORE_ROUTE);
      },
      openPractice: () => {
        router.push(TOOL_ROUTES.practiceHistory.home);
      },
    }),
    [router],
  );
}
