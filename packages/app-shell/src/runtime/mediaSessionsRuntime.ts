import {
  isNotificationListenerEnabled,
  mediaSessionCommand,
  openNotificationListenerSettings,
  subscribeMediaSessions,
} from '@kitbag/core-native';
import {
  configureMediaSessions,
  getMediaSessionsStore,
} from '@kitbag/core-state';
import { chooseSession } from '@kitbag/tool-sync';

import { onAppForeground } from './appForeground.ts';

configureMediaSessions({
  source: {
    subscribe: subscribeMediaSessions,
    command: mediaSessionCommand,
    listenerEnabled: isNotificationListenerEnabled,
    openListenerSettings: openNotificationListenerSettings,
  },
  choose: chooseSession,
});

onAppForeground(() => {
  void getMediaSessionsStore().getState().refresh();
});
