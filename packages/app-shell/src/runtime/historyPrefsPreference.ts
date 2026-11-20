import type { Preferences } from '@kitbag/core-db';
import {
  isHistoryGrouping,
  isSwipeDirection,
  type HistoryPrefs,
  type HistoryPrefsPersistence,
} from '@kitbag/core-state';

import {
  storedPreference,
  writeChanged,
  type StoredPreference,
} from './storedPreference';

export const HISTORY_PREFERENCE_KEYS: Readonly<
  Record<keyof HistoryPrefs, string>
> = {
  grouping: 'practice_history_grouping',
  swipeDirection: 'practice_history_swipe_direction',
};

export function historyPrefsPersistence(
  stored: (key: keyof HistoryPrefs) => StoredPreference,
): HistoryPrefsPersistence {
  return {
    load: () => {
      const grouping = stored('grouping').read();
      const swipeDirection = stored('swipeDirection').read();
      return {
        ...(isHistoryGrouping(grouping) ? { grouping } : {}),
        ...(isSwipeDirection(swipeDirection) ? { swipeDirection } : {}),
      };
    },
    save: (changed) => {
      writeChanged(changed, stored, String);
    },
  };
}

export function historyPrefsPreference(
  preferences: () => Preferences,
): HistoryPrefsPersistence {
  return historyPrefsPersistence((key) =>
    storedPreference(
      preferences,
      HISTORY_PREFERENCE_KEYS[key],
      'practice history setting',
    ),
  );
}
