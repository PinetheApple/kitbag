import type { AppNightMode } from '@kitbag/core-native';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  createAppearanceStore,
  DEFAULT_APPEARANCE,
  THEME_CHOICES,
  type AppearancePersistence,
  type AppearanceSettings,
  type ThemeChoice,
} from './store.ts';

function memoryPersistence(initial: Partial<AppearanceSettings> = {}) {
  let stored: Partial<AppearanceSettings> = initial;
  const saves: Partial<AppearanceSettings>[] = [];
  const persistence: AppearancePersistence = {
    load: () => stored,
    save: (changed) => {
      saves.push(changed);
      stored = { ...stored, ...changed };
    },
  };
  return { persistence, saves };
}

describe('appearance settings', () => {
  it('follow the system theme with haptics and keep-awake on when nothing is stored', () => {
    const { persistence } = memoryPersistence();
    const state = createAppearanceStore(persistence).getState();
    expect(state.theme).toBe('system');
    expect(state.haptics).toBe(true);
    expect(state.keepScreenAwake).toBe(true);
    expect(DEFAULT_APPEARANCE).toEqual({
      theme: 'system',
      haptics: true,
      keepScreenAwake: true,
    });
  });

  it('survive a reload', () => {
    const { persistence } = memoryPersistence();
    const first = createAppearanceStore(persistence).getState();
    first.setTheme('light');
    first.setHaptics(false);
    first.setKeepScreenAwake(false);

    const reloaded = createAppearanceStore(persistence).getState();
    expect(reloaded.theme).toBe('light');
    expect(reloaded.haptics).toBe(false);
    expect(reloaded.keepScreenAwake).toBe(false);
  });

  it('keep the defaults for whatever storage does not hold', () => {
    const { persistence } = memoryPersistence({ haptics: false });
    const state = createAppearanceStore(persistence).getState();
    expect(state.theme).toBe(DEFAULT_APPEARANCE.theme);
    expect(state.haptics).toBe(false);
    expect(state.keepScreenAwake).toBe(DEFAULT_APPEARANCE.keepScreenAwake);
  });

  it('skip the write when a value does not change', () => {
    const { persistence, saves } = memoryPersistence();
    createAppearanceStore(persistence).getState().setTheme('system');
    expect(saves).toEqual([]);
  });
});

describe('theme choices', () => {
  it('are exactly the native night modes, each listed once', () => {
    expectTypeOf<ThemeChoice>().toEqualTypeOf<AppNightMode>();
    expectTypeOf<
      (typeof THEME_CHOICES)[number]
    >().toEqualTypeOf<AppNightMode>();
    expect(new Set(THEME_CHOICES).size).toBe(THEME_CHOICES.length);
  });
});
