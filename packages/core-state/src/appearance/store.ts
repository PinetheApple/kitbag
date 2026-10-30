import { createStore, type StoreApi } from 'zustand/vanilla';

export const THEME_CHOICES = ['system', 'dark', 'light'] as const;

export type ThemeChoice = (typeof THEME_CHOICES)[number];

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
  readonly read: (key: AppearanceKey) => string | undefined;
  readonly write: (key: AppearanceKey, value: string) => void;
}

export interface AppearanceStore extends AppearanceSettings {
  readonly setTheme: (theme: ThemeChoice) => void;
  readonly setHaptics: (on: boolean) => void;
  readonly setKeepScreenAwake: (on: boolean) => void;
}

const FLAG = { on: '1', off: '0' } as const;

function isThemeChoice(value: string | undefined): value is ThemeChoice {
  return THEME_CHOICES.some((choice) => choice === value);
}

function parseFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === FLAG.on) return true;
  if (value === FLAG.off) return false;
  return fallback;
}

function load(persistence: AppearancePersistence): AppearanceSettings {
  const theme = persistence.read('theme');
  return {
    theme: isThemeChoice(theme) ? theme : DEFAULT_APPEARANCE.theme,
    haptics: parseFlag(persistence.read('haptics'), DEFAULT_APPEARANCE.haptics),
    keepScreenAwake: parseFlag(
      persistence.read('keepScreenAwake'),
      DEFAULT_APPEARANCE.keepScreenAwake,
    ),
  };
}

const inMemory: AppearancePersistence = {
  read: () => undefined,
  write: () => undefined,
};

export function createAppearanceStore(
  persistence: AppearancePersistence = inMemory,
): StoreApi<AppearanceStore> {
  return createStore<AppearanceStore>((set, get) => {
    const setFlag = (key: 'haptics' | 'keepScreenAwake', on: boolean) => {
      if (get()[key] === on) return;
      set({ [key]: on });
      persistence.write(key, on ? FLAG.on : FLAG.off);
    };
    return {
      ...load(persistence),
      setTheme: (theme) => {
        if (get().theme === theme) return;
        set({ theme });
        persistence.write('theme', theme);
      },
      setHaptics: (on) => {
        setFlag('haptics', on);
      },
      setKeepScreenAwake: (on) => {
        setFlag('keepScreenAwake', on);
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
