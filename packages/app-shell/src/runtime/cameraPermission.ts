import type { StemDeckCamera } from '@kitbag/core-state';
import { Linking, PermissionsAndroid } from 'react-native';

import { androidPermission } from './androidPermission.ts';

function warn(error: unknown): void {
  console.warn('[kitbag] camera settings', error);
}

export const cameraPermission: StemDeckCamera = {
  ...androidPermission(PermissionsAndroid.PERMISSIONS.CAMERA, 'denied'),
  openSettings: () => {
    Linking.openSettings().catch(warn);
  },
};
