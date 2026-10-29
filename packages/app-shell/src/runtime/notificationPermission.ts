import { PermissionsAndroid, Platform } from 'react-native';

const POST_NOTIFICATIONS_RUNTIME_SDK = 33;

let asked = false;

export function askForNotificationsOnce(): void {
  if (asked || Platform.OS !== 'android') return;
  asked = true;
  if (Platform.Version < POST_NOTIFICATIONS_RUNTIME_SDK) return;
  void PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
}
