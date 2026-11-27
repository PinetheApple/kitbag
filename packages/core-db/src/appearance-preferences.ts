export const APPEARANCE_PREFERENCE_KEYS = {
  theme: 'appearance_theme',
  haptics: 'appearance_haptics',
  keepScreenAwake: 'appearance_keep_screen_awake',
} as const;

export const HOME_LAYOUT_KEY = 'home_layout';

export const APPEARANCE_STORED_KEYS: readonly string[] = [
  ...Object.values(APPEARANCE_PREFERENCE_KEYS),
  HOME_LAYOUT_KEY,
];
