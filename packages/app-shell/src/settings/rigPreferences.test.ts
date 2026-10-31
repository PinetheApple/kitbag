import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import type { StoredPreference } from '../runtime/storedPreference.ts';
import {
  accentsPersistence,
  RIG_KEYS,
  volumePersistence,
} from './rigPreferences.ts';

function memory(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const stored = (key: string): StoredPreference => ({
    read: () => data.get(key),
    write: (value) => {
      data.set(key, value);
    },
  });
  return { stored, data };
}

describe('subdivision accents on the database', () => {
  it('survive a reload', () => {
    const { stored } = memory();
    const masks = [0, 0, 0, 0, 0b100];
    accentsPersistence(stored).save({ masks, lastCount: 4 });
    expect(accentsPersistence(stored).load()).toEqual({ masks, lastCount: 4 });
  });

  it('load nothing from a value they cannot read', () => {
    const { stored } = memory({
      [RIG_KEYS.accentMasks]: '{not json',
      [RIG_KEYS.accentCount]: 'four',
    });
    expect(accentsPersistence(stored).load()).toEqual({});
  });
});

describe('click volume on the database', () => {
  it('survives a reload', () => {
    const { stored } = memory();
    volumePersistence(stored).save(1.7);
    expect(volumePersistence(stored).load()).toBe(1.7);
  });

  it('ignores a stored volume outside the engine range', () => {
    const { stored } = memory({
      [RIG_KEYS.volume]: String(KB_VOLUME_BOUNDS.max + 1),
    });
    expect(volumePersistence(stored).load()).toBeUndefined();
  });
});
