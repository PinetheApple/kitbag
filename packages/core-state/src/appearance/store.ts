import type { AppNightMode } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

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

const inMemory: AppearancePersistence = {
  load: () => ({}),
  save: () => undefined,
};

export function createAppearanceStore(
  persistence: AppearancePersistence = inMemory,
): StoreApi<AppearanceStore> {
  return createStore<AppearanceStore>((set, get) => {
    const change = <K extends AppearanceKey>(
      key: K,
      value: AppearanceSettings[K],
    ) => {
      if (get()[key] === value) return;
      const changed = { [key]: value } as Pick<AppearanceSettings, K>;
      set(changed);
      persistence.save(changed);
    };
    return {
      ...DEFAULT_APPEARANCE,
      ...persistence.load(),
      setTheme: (theme) => {
        change('theme', theme);
      },
      setHaptics: (on) => {
        change('haptics', on);
      },
      setKeepScreenAwake: (on) => {
        change('keepScreenAwake', on);
      },
    };
  });
}

let configured: StoreApi<AppearanceStore> | undefined;

export function configureAppearancePersistence(
  persistence: AppearancePersistence,
): void {
  if (configured !== undefined) {
    throw new Error(
      'Appearance store already exists; configure persistence before first use',
    );
  }
  configured = createAppearanceStore(persistence);
}

export function getAppearanceStore(): StoreApi<AppearanceStore> {
  configured ??= createAppearanceStore();
  return configured;
}
