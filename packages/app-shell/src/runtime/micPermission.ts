import type { AppActivity } from '@kitbag/core-state';

// Pure mappings from react-native's platform answers to core-state's terms,
// kept free of react-native imports so vitest can cover them.

export function appActivityFromState(state: string): AppActivity | undefined {
  if (state === 'active') return 'active';
  if (state === 'background') return 'background';
  return undefined;
}
