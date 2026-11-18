import type { StemDeckCamera } from '@kitbag/core-state';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import { permissionFromRequest } from './permissionAnswer.ts';

const CAMERA = PermissionsAndroid.PERMISSIONS.CAMERA;

function warn(error: unknown): void {
  console.warn('[kitbag] camera settings', error);
}

// Android only, like the mic: check() cannot tell a denial from never-ask-again.
export const cameraPermission: StemDeckCamera = {
  check: async () => {
    if (Platform.OS !== 'android') return 'denied';
    return (await PermissionsAndroid.check(CAMERA)) ? 'granted' : 'denied';
  },
  request: async () => {
    if (Platform.OS !== 'android') return 'denied';
    const answer = await PermissionsAndroid.request(CAMERA);
    return permissionFromRequest(answer, PermissionsAndroid.RESULTS);
  },
  openSettings: () => {
    Linking.openSettings().catch(warn);
  },
};
