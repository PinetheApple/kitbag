import { useRouter } from 'expo-router';
import { useMemo } from 'react';

import { TOOL_ROUTES } from '@/home/toolRoutes';

export const SHEET_PARAM = 'sheet';
export const DATA_FOLDER_SHEET = 'dataFolder';
export const RESTORE_ROUTE = '/settings/restore';
export const TOOLS_ROUTE = '/settings/tools';
export const TOOL_PAGE_ROUTE = '/settings/tools/[id]';
export const TOOL_DOWNLOADS_ROUTE = '/settings/tool-downloads';
export const TOOL_PARAM = 'id';
export const REMOVED_PARAM = 'removed';

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
        router.push(TOOLS_ROUTE);
      },
      openToolPage: (toolId: string) => {
        router.push({
          pathname: TOOL_PAGE_ROUTE,
          params: { [TOOL_PARAM]: toolId },
        });
      },
      openToolDownloads: (toolId?: string) => {
        router.push({
          pathname: TOOL_DOWNLOADS_ROUTE,
          params: toolId === undefined ? {} : { [TOOL_PARAM]: toolId },
        });
      },
      toolRemoved: (toolId: string) => {
        router.dismissTo({
          pathname: TOOLS_ROUTE,
          params: { [REMOVED_PARAM]: toolId },
        });
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
