import { describe, expect, it } from 'vitest';

import {
  createAppearanceStore,
  DEFAULT_APPEARANCE,
  type AppearanceKey,
  type AppearancePersistence,
} from './store.ts';

function memoryPersistence(
  initial: Partial<Record<AppearanceKey, string>> = {},
) {
  const data = new Map<AppearanceKey, string>(
    Object.entries(initial) as [AppearanceKey, string][],
  );
  const persistence: AppearancePersistence = {
    read: (key) => data.get(key),
    write: (key, value) => {
      data.set(key, value);
    },
  };
  return { persistence, data };
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

  it('fall back to the default for a value they do not recognise', () => {
    const { persistence } = memoryPersistence({
      theme: 'sepia',
      haptics: 'yes',
      keepScreenAwake: '',
    });
    const state = createAppearanceStore(persistence).getState();
    expect(state.theme).toBe(DEFAULT_APPEARANCE.theme);
    expect(state.haptics).toBe(DEFAULT_APPEARANCE.haptics);
    expect(state.keepScreenAwake).toBe(DEFAULT_APPEARANCE.keepScreenAwake);
  });

  it('skip the write when a value does not change', () => {
    const { persistence, data } = memoryPersistence();
    createAppearanceStore(persistence).getState().setTheme('system');
    expect(data.size).toBe(0);
  });
});
