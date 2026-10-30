import { palette, type ThemeMode } from '@kitbag/core-design';
import { setHapticsEnabled } from '@kitbag/core-native';
import {
  configureAppearancePersistence,
  getAppearanceStore,
  type ThemeChoice,
} from '@kitbag/core-state';
import * as SystemUI from 'expo-system-ui';
import { Appearance, type ColorSchemeName } from 'react-native';

import { appearancePreference } from './appearancePreference';
import { getDatabase } from './database';

configureAppearancePersistence(
  appearancePreference(() => getDatabase().preferences),
);

const store = getAppearanceStore();
setHapticsEnabled(store.getState().haptics);
store.subscribe((state) => {
  setHapticsEnabled(state.haptics);
});

const OS_SCHEME: Readonly<Record<ThemeChoice, ColorSchemeName>> = {
  system: 'unspecified',
  dark: 'dark',
  light: 'light',
};

// The one place the theme reaches the OS; A10's setAppNightMode belongs here too.
export function applyAppearance(choice: ThemeChoice, mode: ThemeMode): void {
  Appearance.setColorScheme(OS_SCHEME[choice]);
  SystemUI.setBackgroundColorAsync(palette.bg[mode]).catch(() => undefined);
}
