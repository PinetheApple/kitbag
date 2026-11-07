import type { AppActivity } from '@kitbag/core-state';

export function appActivityFromState(state: string): AppActivity | undefined {
  if (state === 'active') return 'active';
  if (state === 'background') return 'background';
  return undefined;
}

// Unmapped fails closed: the next change event starts the mic.
export function currentAppActivity(state: string): AppActivity {
  return appActivityFromState(state) ?? 'background';
}
