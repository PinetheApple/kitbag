import { palette, type ThemeMode } from '@kitbag/core-design';
import {
  configureAppearancePersistence,
  type AppearanceKey,
  type ThemeChoice,
} from '@kitbag/core-state';
import * as SystemUI from 'expo-system-ui';

import { APPEARANCE_KEYS, appearancePersistence } from './appearancePreference';
import { storedWebPreference } from './storedWebPreference';

const WEB_KEY_PREFIX = 'kitbag.';

configureAppearancePersistence(
  appearancePersistence((key: AppearanceKey) =>
    storedWebPreference(`${WEB_KEY_PREFIX}${APPEARANCE_KEYS[key]}`),
  ),
);

// The browser has no OS scheme to override; the theme resolves in JS.
export function applyAppearance(_choice: ThemeChoice, mode: ThemeMode): void {
  SystemUI.setBackgroundColorAsync(palette.bg[mode]).catch(() => undefined);
}
