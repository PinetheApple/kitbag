import { palette } from '@kitbag/core-design';
import type { AppNightMode } from '@kitbag/core-native';
import type { ThemeChoice } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  appearanceApplier,
  keepNightMode,
  resolveThemeMode,
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

function recordingApplier() {
  const calls = {
    nightModes: [] as AppNightMode[],
    lightBars: [] as boolean[],
    backgrounds: [] as string[],
  };
  const apply = appearanceApplier({
    setNightMode: (mode) => calls.nightModes.push(mode),
    setSystemBarAppearance: (light) => calls.lightBars.push(light),
    setBackgroundColor: (hex) => calls.backgrounds.push(hex),
  });
  return { apply, calls };
}

describe('appearanceApplier', () => {
  it.each<ThemeChoice>(['system', 'dark', 'light'])(
    'hands native night mode %s unchanged with the resolved background',
    (choice) => {
      const { apply, calls } = recordingApplier();
      apply(choice, 'light');
      expect(calls.nightModes).toEqual([choice]);
      expect(calls.backgrounds).toEqual([palette.bg.light]);
    },
  );

  it('asks for dark bar icons only while the resolved theme is light', () => {
    const { apply, calls } = recordingApplier();
    apply('system', 'dark');
    apply('system', 'light');
    apply('system', 'dark');
    expect(calls.lightBars).toEqual([false, true, false]);
  });
});

describe('keepNightMode', () => {
  it('applies the stored choice at once and again on every foreground', () => {
    let choice: ThemeChoice = 'light';
    let foreground = (): void => undefined;
    const applied: AppNightMode[] = [];
    keepNightMode({
      choice: () => choice,
      setNightMode: (mode) => applied.push(mode),
      onForeground: (listener) => {
        foreground = listener;
      },
    });
    expect(applied).toEqual(['light']);
    choice = 'dark';
    foreground();
    foreground();
    expect(applied).toEqual(['light', 'dark', 'dark']);
  });
});
