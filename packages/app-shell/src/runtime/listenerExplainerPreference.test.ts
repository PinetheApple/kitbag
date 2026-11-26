import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { listenerExplainerPreference } from './listenerExplainerPreference.ts';

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

describe('the access explainer "Not now" on the database', () => {
  it('is unanswered until saved, then declined after a reload', () => {
    const preferences = memoryPreferences();
    expect(listenerExplainerPreference(() => preferences).load()).toBe(false);
    listenerExplainerPreference(() => preferences).save();
    expect(listenerExplainerPreference(() => preferences).load()).toBe(true);
  });
});
