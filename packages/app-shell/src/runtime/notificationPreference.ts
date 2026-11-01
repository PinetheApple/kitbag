import type { Preferences } from '@kitbag/core-db';
import type {
  NotificationAsk,
  NotificationAskPersistence,
} from '@kitbag/core-state';

import { storedPreference } from './storedPreference';

const KEY = 'notification_permission_ask';
const NEVER: NotificationAsk = 'never';
const STORED: readonly NotificationAsk[] = ['asked', 'blocked'];

function isStored(value: string | undefined): value is NotificationAsk {
  return STORED.some((ask) => ask === value);
}

export function notificationAskPreference(
  preferences: () => Preferences,
): NotificationAskPersistence {
  const stored = storedPreference(
    preferences,
    KEY,
    'notification permission ask',
  );
  return {
    load: () => {
      const value = stored.read();
      return isStored(value) ? value : NEVER;
    },
    save: (ask) => {
      stored.write(ask);
    },
  };
}
