import { KB_COUNT_IN_OFF } from '@kitbag/core-native';

import { isCountInBars, type CountInConfig } from './config.ts';

export const COUNT_IN_SCOPE = { perSong: 'perSong', always: 'always' } as const;
export type CountInScope = (typeof COUNT_IN_SCOPE)[keyof typeof COUNT_IN_SCOPE];
export const COUNT_IN_SCOPES: readonly CountInScope[] =
  Object.values(COUNT_IN_SCOPE);
export const DEFAULT_COUNT_IN_SCOPE: CountInScope = COUNT_IN_SCOPE.perSong;

export function isCountInScope(value: unknown): value is CountInScope {
  return COUNT_IN_SCOPES.some((scope) => scope === value);
}

export function songCountIn(
  scope: CountInScope,
  songBars: number,
  live: CountInConfig,
): CountInConfig {
  if (scope === COUNT_IN_SCOPE.always) return live;
  return {
    ...live,
    bars: isCountInBars(songBars) ? songBars : KB_COUNT_IN_OFF,
  };
}
