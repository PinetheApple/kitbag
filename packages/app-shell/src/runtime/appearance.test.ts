import { palette } from '@kitbag/core-design';
import type { ThemeChoice } from '@kitbag/core-state';
import type { ColorSchemeName } from 'react-native';
import { describe, expect, it } from 'vitest';

import {
  appearanceApplier,
  resolveThemeMode,
  statusBarStyle,
} from './appearance.ts';

describe('resolveThemeMode', () => {
  it.each(['light', 'dark'] as const)(
    'follows the OS on System when the OS is %s',
    (os) => {
      expect(resolveThemeMode('system', os)).toBe(os);
    },
  );

  it.each([null, undefined, 'unspecified'] as const)(
    'falls back to dark on System when the OS reports %s',
    (os) => {
      expect(resolveThemeMode('system', os)).toBe('dark');
    },
  );

  it.each([
    ['dark', 'light'],
    ['light', 'dark'],
  ] as const)('keeps an explicit %s over an OS in %s', (choice, os) => {
    expect(resolveThemeMode(choice, os)).toBe(choice);
  });
});

describe('statusBarStyle', () => {
  it('draws light icons on the dark theme and dark icons on the light one', () => {
    expect(statusBarStyle('dark')).toBe('light');
    expect(statusBarStyle('light')).toBe('dark');
  });
});

describe('appearanceApplier', () => {
  it.each([
    ['system', 'unspecified'],
    ['dark', 'dark'],
    ['light', 'light'],
  ] as const)(
    'hands the OS %s as %s with the resolved background',
    (choice: ThemeChoice, scheme: ColorSchemeName) => {
      const schemes: ColorSchemeName[] = [];
      const backgrounds: string[] = [];
      const apply = appearanceApplier({
        setColorScheme: (s) => schemes.push(s),
        setBackgroundColor: (hex) => backgrounds.push(hex),
      });
      apply(choice, 'light');
      expect(schemes).toEqual([scheme]);
      expect(backgrounds).toEqual([palette.bg.light]);
    },
  );
});
