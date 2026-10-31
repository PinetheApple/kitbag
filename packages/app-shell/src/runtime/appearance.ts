import { palette, type ThemeMode } from '@kitbag/core-design';
import type { AppNightMode } from '@kitbag/core-native';
import type { ThemeChoice } from '@kitbag/core-state';
import type { ColorSchemeName } from 'react-native';

export function resolveThemeMode(
  choice: ThemeChoice,
  os: ColorSchemeName | null | undefined,
): ThemeMode {
  if (choice !== 'system') return choice;
  return os === 'light' ? 'light' : 'dark';
}

export interface SystemAppearance {
  readonly setNightMode: (mode: AppNightMode) => void;
  readonly setSystemBarAppearance: (light: boolean) => void;
  readonly setBackgroundColor: (hex: string) => void;
}

export function appearanceApplier(system: SystemAppearance) {
  return (choice: ThemeChoice, mode: ThemeMode): void => {
    system.setNightMode(choice);
    system.setBackgroundColor(palette.bg[mode]);
    system.setSystemBarAppearance(mode === 'light');
  };
}

export interface NightModeKeeper {
  readonly choice: () => ThemeChoice;
  readonly setNightMode: (mode: AppNightMode) => void;
  readonly onForeground: (listener: () => void) => void;
}

export function keepNightMode(keeper: NightModeKeeper): void {
  const apply = (): void => {
    keeper.setNightMode(keeper.choice());
  };
  apply();
  keeper.onForeground(apply);
}
