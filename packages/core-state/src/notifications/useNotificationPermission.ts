import { useStore } from 'zustand';

import {
  getNotificationPermissionStore,
  type NotificationPermissionStore,
} from './store.ts';

export function useNotificationPermission<T>(
  selector: (state: NotificationPermissionStore) => T,
): T {
  return useStore(getNotificationPermissionStore(), selector);
}
