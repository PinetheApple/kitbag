import type { ThemeMode } from '@kitbag/core-design';
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

const ICONS_FOR: Readonly<Record<ThemeMode, StatusBarStyle>> = {
  dark: 'light',
  light: 'dark',
};

export function statusBarStyle(mode: ThemeMode): StatusBarStyle {
  return ICONS_FOR[mode];
}
