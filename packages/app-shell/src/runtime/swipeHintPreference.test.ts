import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { swipeHintPreference } from './swipeHintPreference.ts';

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

describe('swipe hint dismissal on the database', () => {
  it('is unseen until dismissed, then seen after a reload', () => {
    const preferences = memoryPreferences();
    expect(swipeHintPreference(() => preferences).load()).toBe(false);
    swipeHintPreference(() => preferences).save();
    expect(swipeHintPreference(() => preferences).load()).toBe(true);
  });

  it('shows the hint again, without throwing, when the database will not open', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const persistence = swipeHintPreference(() => {
      throw new Error('cannot open');
    });
    expect(persistence.load()).toBe(false);
    expect(() => {
      persistence.save();
    }).not.toThrow();
    warn.mockRestore();
  });
});
