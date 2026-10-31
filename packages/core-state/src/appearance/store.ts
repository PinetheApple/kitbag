import type { AppNightMode } from '@kitbag/core-native';

import { persistedStore } from '../persistedStore.ts';

export type ThemeChoice = AppNightMode;

export const THEME_CHOICES = [
  'system',
  'dark',
  'light',
] as const satisfies readonly ThemeChoice[];

export interface AppearanceSettings {
  readonly theme: ThemeChoice;
  readonly haptics: boolean;
  readonly keepScreenAwake: boolean;
}

export type AppearanceKey = keyof AppearanceSettings;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'system',
  haptics: true,
  keepScreenAwake: true,
};

export interface AppearancePersistence {
  readonly load: () => Partial<AppearanceSettings>;
  readonly save: (changed: Partial<AppearanceSettings>) => void;
}

export interface AppearanceStore extends AppearanceSettings {
  readonly setTheme: (theme: ThemeChoice) => void;
  readonly setHaptics: (on: boolean) => void;
  readonly setKeepScreenAwake: (on: boolean) => void;
}

const appearance = persistedStore<AppearancePersistence, AppearanceStore>(
  'Appearance',
  { load: () => ({}), save: () => undefined },
  (persistence, commit) => ({
    ...DEFAULT_APPEARANCE,
    ...persistence.load(),
    setTheme: (theme) => {
      commit('theme', theme, () => {
        persistence.save({ theme });
      });
    },
    setHaptics: (on) => {
      commit('haptics', on, () => {
        persistence.save({ haptics: on });
      });
    },
    setKeepScreenAwake: (on) => {
      commit('keepScreenAwake', on, () => {
        persistence.save({ keepScreenAwake: on });
      });
    },
  }),
);

export const createAppearanceStore = appearance.create;
export const configureAppearancePersistence = appearance.configure;
export const getAppearanceStore = appearance.get;
