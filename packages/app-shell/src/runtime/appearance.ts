import { palette, type ThemeMode } from '@kitbag/core-design';
import type { ThemeChoice } from '@kitbag/core-state';
import type { StatusBarStyle } from 'expo-status-bar';
import type { ColorSchemeName } from 'react-native';

export function resolveThemeMode(
  choice: ThemeChoice,
  os: ColorSchemeName | null | undefined,
): ThemeMode {
  if (choice !== 'system') return choice;
  return os === 'light' ? 'light' : 'dark';
}

const STATUS_BAR_STYLE: Readonly<Record<ThemeMode, StatusBarStyle>> = {
  dark: 'light',
  light: 'dark',
};

export function statusBarStyle(mode: ThemeMode): StatusBarStyle {
  return STATUS_BAR_STYLE[mode];
}

const OS_SCHEME: Readonly<Record<ThemeChoice, ColorSchemeName>> = {
  system: 'unspecified',
  dark: 'dark',
  light: 'light',
};

export interface SystemAppearance {
  readonly setColorScheme: (scheme: ColorSchemeName) => void;
  readonly setBackgroundColor: (hex: string) => void;
}

export function appearanceApplier(system: SystemAppearance) {
  return (choice: ThemeChoice, mode: ThemeMode): void => {
    system.setColorScheme(OS_SCHEME[choice]);
    system.setBackgroundColor(palette.bg[mode]);
  };
}
