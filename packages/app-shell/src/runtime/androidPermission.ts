import type { PermissionAnswer } from '@kitbag/core-state';
import { PermissionsAndroid, Platform, type Permission } from 'react-native';

import { permissionFromRequest } from './permissionAnswer.ts';

export interface PermissionSource {
  readonly check: () => Promise<PermissionAnswer>;
  readonly request: () => Promise<PermissionAnswer>;
}

// check() cannot tell a plain denial from never-ask-again; only request() can.
export function androidPermission(
  permission: Permission,
  offPlatform: PermissionAnswer,
): PermissionSource {
  return {
    check: async () => {
      if (Platform.OS !== 'android') return offPlatform;
      return (await PermissionsAndroid.check(permission))
        ? 'granted'
        : 'denied';
    },
    request: async () => {
      if (Platform.OS !== 'android') return offPlatform;
      const answer = await PermissionsAndroid.request(permission);
      return permissionFromRequest(answer, PermissionsAndroid.RESULTS);
    },
  };
}
