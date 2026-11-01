import type { AppActivity } from '@kitbag/core-state';

export function appActivityFromState(state: string): AppActivity | undefined {
  if (state === 'active') return 'active';
  if (state === 'background') return 'background';
  return undefined;
}
