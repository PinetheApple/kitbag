export const RIG_PREFERENCE_KEYS = {
  volume: 'rig_volume',
  accentMasks: 'rig_subdivision_accents',
  accentCount: 'rig_subdivision_accent_count',
} as const;

export const RIG_STORED_KEYS: readonly string[] =
  Object.values(RIG_PREFERENCE_KEYS);
