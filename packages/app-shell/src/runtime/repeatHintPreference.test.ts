import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { repeatHintPreference } from './repeatHintPreference.ts';

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

describe('the Repeat all hint flag on the database', () => {
  it('is unseen until saved, then seen after a reload', () => {
    const preferences = memoryPreferences();
    expect(repeatHintPreference(() => preferences).load()).toBe(false);
    repeatHintPreference(() => preferences).save();
    expect(repeatHintPreference(() => preferences).load()).toBe(true);
  });
});
