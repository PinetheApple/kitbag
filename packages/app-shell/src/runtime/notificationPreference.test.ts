import type { Preferences } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { notificationAskPreference } from './notificationPreference.ts';

function memoryPreferences(initial: Record<string, string> = {}): Preferences {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

describe('notification ask on the database', () => {
  it('is never asked on a fresh install, and remembered after a reload', () => {
    const preferences = memoryPreferences();
    expect(notificationAskPreference(() => preferences).load()).toBe('never');
    notificationAskPreference(() => preferences).save('blocked');
    expect(notificationAskPreference(() => preferences).load()).toBe('blocked');
  });

  it('reads a value it does not recognise as never asked', () => {
    const preferences = memoryPreferences({
      notification_permission_ask: 'maybe',
    });
    expect(notificationAskPreference(() => preferences).load()).toBe('never');
  });
});
