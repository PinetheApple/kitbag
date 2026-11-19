import type { Preferences } from '@kitbag/core-db';
import { HISTORY_GROUPING, SWIPE_DIRECTION } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { historyPrefsPreference } from './historyPrefsPreference.ts';

function memoryPreferences(): Preferences & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (key) => data.get(key),
    set: (key, value) => {
      data.set(key, value);
      return Promise.resolve();
    },
  };
}

describe('practice history settings on the database', () => {
  it('reads back what was saved', () => {
    const preferences = memoryPreferences();
    historyPrefsPreference(() => preferences).save({
      swipeDirection: SWIPE_DIRECTION.right,
      grouping: HISTORY_GROUPING.week,
    });
    expect(historyPrefsPreference(() => preferences).load()).toEqual({
      swipeDirection: SWIPE_DIRECTION.right,
      grouping: HISTORY_GROUPING.week,
    });
  });

  it('ignores a value it does not know', () => {
    const preferences = memoryPreferences();
    preferences.data.set('practice_history_swipe_direction', 'up');
    preferences.data.set('practice_history_grouping', 'year');
    expect(historyPrefsPreference(() => preferences).load()).toEqual({});
  });
});
