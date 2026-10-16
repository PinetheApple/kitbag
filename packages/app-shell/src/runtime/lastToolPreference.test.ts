import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { lastToolPreference } from './lastToolPreference.ts';

function memoryPreferences(): Preferences {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

describe('last-used tool on the database', () => {
  it('survives a reload', () => {
    const preferences = memoryPreferences();
    lastToolPreference(() => preferences).save('tuner');
    expect(lastToolPreference(() => preferences).load()).toBe('tuner');
  });

  it('has nothing to continue, and does not throw, when the database will not open', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const persistence = lastToolPreference(() => {
      throw new Error('cannot open');
    });
    expect(persistence.load()).toBeUndefined();
    expect(() => {
      persistence.save('tuner');
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('reports a write that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing: Preferences = {
      get: () => undefined,
      set: () => Promise.reject(new Error('disk full')),
    };
    lastToolPreference(() => failing).save('tuner');
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledTimes(1);
    });
    warn.mockRestore();
  });
});
