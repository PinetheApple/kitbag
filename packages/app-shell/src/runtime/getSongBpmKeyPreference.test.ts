import type { Preferences } from '@kitbag/core-db';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getSongBpmKeyPreference } from './getSongBpmKeyPreference.ts';

const PERSONAL_KEY = 'gsb-personal-7f3a9c';

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

const brokenPreferences: Preferences = {
  get: () => {
    throw new Error('database closed');
  },
  set: () => Promise.reject(new Error('disk full')),
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GetSongBPM key on the database', () => {
  it('reads no key on a fresh install', () => {
    const preferences = memoryPreferences();
    expect(getSongBpmKeyPreference(() => preferences).load()).toBe('');
  });

  it('keeps a saved key across a reload, and forgets a removed one', () => {
    const preferences = memoryPreferences();
    getSongBpmKeyPreference(() => preferences).save(PERSONAL_KEY);
    expect(getSongBpmKeyPreference(() => preferences).load()).toBe(
      PERSONAL_KEY,
    );
    getSongBpmKeyPreference(() => preferences).save('');
    expect(getSongBpmKeyPreference(() => preferences).load()).toBe('');
  });

  it('never prints the key when the database fails', async () => {
    const printed = ['log', 'info', 'warn', 'error', 'debug'].map((level) =>
      vi.spyOn(console, level as 'log').mockImplementation(() => undefined),
    );
    const persistence = getSongBpmKeyPreference(() => brokenPreferences);
    persistence.save(PERSONAL_KEY);
    persistence.load();
    await Promise.resolve();
    const output = printed.flatMap((spy) => spy.mock.calls).flat();
    expect(output.length).toBeGreaterThan(0);
    expect(output.map((arg) => String(arg)).join('\n')).not.toContain(
      PERSONAL_KEY,
    );
  });
});
