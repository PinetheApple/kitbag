import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  APPEARANCE_KEYS,
  appearancePreference,
} from './appearancePreference.ts';

function memoryPreferences() {
  const data = new Map<string, string>();
  const preferences: Preferences = {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
  return { preferences, data };
}

describe('appearance settings on the database', () => {
  it('survive a reload, each under its own key', () => {
    const { preferences, data } = memoryPreferences();
    appearancePreference(() => preferences).write('theme', 'light');
    appearancePreference(() => preferences).write('haptics', '0');

    const reloaded = appearancePreference(() => preferences);
    expect(reloaded.read('theme')).toBe('light');
    expect(reloaded.read('haptics')).toBe('0');
    expect(reloaded.read('keepScreenAwake')).toBeUndefined();
    expect([...data.keys()]).toEqual([
      APPEARANCE_KEYS.theme,
      APPEARANCE_KEYS.haptics,
    ]);
  });
});
