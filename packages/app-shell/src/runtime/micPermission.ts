import type { AppActivity, MicPermission } from '@kitbag/core-state';

// Pure mappings from react-native's platform answers to core-state's terms,
// kept free of react-native imports so vitest can cover them.

/** PermissionsAndroid.RESULTS, as far as the mapping needs it. */
export interface PermissionResults {
  readonly GRANTED: string;
  readonly NEVER_ASK_AGAIN: string;
}

/** Map a PermissionsAndroid.request answer. */
export function micPermissionFromRequest(
  answer: string,
  results: PermissionResults,
): MicPermission {
  if (answer === results.GRANTED) return 'granted';
  if (answer === results.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

/** Map an AppState value. The store takes `active` and `background` only. */
export function appActivityFromState(state: string): AppActivity | undefined {
  if (state === 'active') return 'active';
  if (state === 'background') return 'background';
  return undefined;
}
