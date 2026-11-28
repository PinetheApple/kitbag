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

import { compiledTools } from '@/compiledTools';

import { onAppForeground } from './appState.ts';
import { listenerExplainerFlag } from './listenerExplainerFlag';

configureMediaSessions({
  source: {
    subscribe: subscribeMediaSessions,
    command: mediaSessionCommand,
    listenerEnabled: isNotificationListenerEnabled,
    openListenerSettings: openNotificationListenerSettings,
    rearm: rearmMediaSessions,
  },
  choose: compiledTools.sync.mediaSession.choose,
  explainerDeclined: listenerExplainerFlag,
});

onAppForeground(() => {
  void getMediaSessionsStore().getState().refresh();
});
