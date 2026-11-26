import {
  isNotificationListenerEnabled,
  mediaSessionCommand,
  openNotificationListenerSettings,
  rearmMediaSessions,
  subscribeMediaSessions,
} from '@kitbag/core-native';
import {
  configureMediaSessions,
  getMediaSessionsStore,
} from '@kitbag/core-state';
import { chooseSession } from '@kitbag/tool-sync';

import { onAppForeground } from './appForeground.ts';
import { listenerExplainerFlag } from './listenerExplainerFlag';

configureMediaSessions({
  source: {
    subscribe: subscribeMediaSessions,
    command: mediaSessionCommand,
    listenerEnabled: isNotificationListenerEnabled,
    openListenerSettings: openNotificationListenerSettings,
    rearm: rearmMediaSessions,
  },
  choose: chooseSession,
  explainer: listenerExplainerFlag,
});

onAppForeground(() => {
  void getMediaSessionsStore().getState().refresh();
});
