import type { Preferences } from '@kitbag/core-db';
import {
  NOTIFICATION_ASK,
  type NotificationAsk,
  type NotificationAskPersistence,
} from '@kitbag/core-state';

import { storedPreference } from './storedPreference';

const KEY = 'notification_permission_ask';
const STORED: readonly NotificationAsk[] = Object.values(NOTIFICATION_ASK);

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
      return isStored(value) ? value : NOTIFICATION_ASK.never;
    },
    save: (ask) => {
      stored.write(ask);
    },
  };
}
