import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import {
  APPEARANCE_KEYS,
  appearancePreference,
} from './appearancePreference.ts';

vi.mock('react-native', () => ({}));
vi.mock('expo-haptics', () => ({}));
vi.mock('@op-engineering/op-sqlite', () => ({}));

function memoryPreferences(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
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
    appearancePreference(() => preferences).save({ theme: 'light' });
    appearancePreference(() => preferences).save({ haptics: false });

    expect(appearancePreference(() => preferences).load()).toEqual({
      theme: 'light',
      haptics: false,
    });
    expect(Object.fromEntries(data)).toEqual({
      [APPEARANCE_KEYS.theme]: 'light',
      [APPEARANCE_KEYS.haptics]: '0',
    });
  });

  it('leave out a value they do not recognise, so the default applies', () => {
    const { preferences } = memoryPreferences({
      [APPEARANCE_KEYS.theme]: 'sepia',
      [APPEARANCE_KEYS.haptics]: 'yes',
      [APPEARANCE_KEYS.keepScreenAwake]: '1',
    });
    expect(appearancePreference(() => preferences).load()).toEqual({
      keepScreenAwake: true,
    });
  });
});
