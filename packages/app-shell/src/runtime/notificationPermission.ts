import {
  configureNotificationPermission,
  getNotificationPermissionStore,
  type PermissionAnswer,
} from '@kitbag/core-state';
import Constants from 'expo-constants';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import { getDatabase } from './database.ts';
import { permissionFromRequest } from './permissionAnswer.ts';
import { notificationAskPreference } from './notificationPreference.ts';

const POST_NOTIFICATIONS_RUNTIME_SDK = 33;
const POST_NOTIFICATIONS = PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS;
const APP_NOTIFICATION_SETTINGS = 'android.settings.APP_NOTIFICATION_SETTINGS';
const EXTRA_APP_PACKAGE = 'android.provider.extra.APP_PACKAGE';
const DENIED: PermissionAnswer = 'denied';

function warn(error: unknown): void {
  console.warn('[kitbag] notification permission', error);
}

function openNotificationSettings(): void {
  const appPackage = Constants.expoConfig?.android?.package;
  const opened =
    appPackage === undefined
      ? Linking.openSettings()
      : Linking.sendIntent(APP_NOTIFICATION_SETTINGS, [
          { key: EXTRA_APP_PACKAGE, value: appPackage },
        ]).catch(() => Linking.openSettings());
  opened.catch(warn);
}

configureNotificationPermission({
  source: {
    required:
      Platform.OS === 'android' &&
      Platform.Version >= POST_NOTIFICATIONS_RUNTIME_SDK,
    granted: () =>
      PermissionsAndroid.check(POST_NOTIFICATIONS).catch((error: unknown) => {
        warn(error);
        return false;
      }),
    request: () =>
      PermissionsAndroid.request(POST_NOTIFICATIONS).then(
        (answer) => permissionFromRequest(answer, PermissionsAndroid.RESULTS),
        (error: unknown) => {
          warn(error);
          return DENIED;
        },
      ),
    openSettings: openNotificationSettings,
  },
  persistence: notificationAskPreference(() => getDatabase().preferences),
});

export function askForNotificationsOnce(): void {
  void getNotificationPermissionStore().getState().playbackStarted();
}
