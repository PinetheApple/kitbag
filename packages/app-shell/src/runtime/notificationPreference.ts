import type { Preferences } from '@kitbag/core-db';
import type {
  NotificationAsk,
  NotificationAskPersistence,
} from '@kitbag/core-state';

import { storedPreference } from './storedPreference';

const KEY = 'notification_permission_ask';
const NEVER: NotificationAsk = 'never';
const ASKED: NotificationAsk = 'asked';

export function notificationAskPreference(
  preferences: () => Preferences,
): NotificationAskPersistence {
  const stored = storedPreference(
    preferences,
    KEY,
    'notification permission ask',
  );
  return {
    load: () => (stored.read() === ASKED ? ASKED : NEVER),
    save: (ask) => {
      stored.write(ask);
    },
  };
}
