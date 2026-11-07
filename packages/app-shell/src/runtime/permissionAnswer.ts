import type { PermissionAnswer } from '@kitbag/core-state';

export interface PermissionResults {
  readonly GRANTED: string;
  readonly NEVER_ASK_AGAIN: string;
}

export function permissionFromRequest(
  answer: string,
  results: PermissionResults,
): PermissionAnswer {
  if (answer === results.GRANTED) return 'granted';
  if (answer === results.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}
