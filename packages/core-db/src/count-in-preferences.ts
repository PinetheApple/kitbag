export const COUNT_IN_PREFERENCE_KEYS = {
  scope: 'count_in_scope',
  bars: 'count_in_bars',
  distinct: 'count_in_distinct',
  sound: 'count_in_sound',
} as const;

export const COUNT_IN_KEYS: readonly string[] = Object.values(
  COUNT_IN_PREFERENCE_KEYS,
);
