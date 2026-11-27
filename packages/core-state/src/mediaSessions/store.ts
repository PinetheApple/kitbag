import type {
  isNotificationListenerEnabled,
  mediaSessionCommand,
  MediaSessionCommand,
  MediaSessionSnapshot,
  openNotificationListenerSettings,
  rearmMediaSessions,
  subscribeMediaSessions,
} from '@kitbag/core-native';

import type { SeenFlagPersistence } from '../firstUse/store.ts';
import { persistedStore } from '../persistedStore.ts';

export interface SessionChoice {
  readonly chosenId: string | undefined;
  readonly pickedId: string | undefined;
}

export type SessionChooser = (
  sessions: readonly MediaSessionSnapshot[],
  choice: SessionChoice,
) => string | undefined;

export interface MediaSessionsSource {
  readonly subscribe: typeof subscribeMediaSessions;
  readonly command: typeof mediaSessionCommand;
  readonly listenerEnabled: typeof isNotificationListenerEnabled;
  readonly openListenerSettings: typeof openNotificationListenerSettings;
  readonly rearm: typeof rearmMediaSessions;
}

export interface MediaSessionsRuntime {
  readonly source: MediaSessionsSource;
  readonly choose: SessionChooser;
  readonly explainerDeclined: SeenFlagPersistence;
}

export interface MediaSessionsStore extends SessionChoice {
  readonly access: boolean | undefined;
  readonly sessions: readonly MediaSessionSnapshot[];
  readonly watch: () => () => void;
  readonly refresh: () => Promise<void>;
  readonly openSettings: () => Promise<boolean>;
  readonly pick: (sessionId: string) => void;
  readonly command: (command: MediaSessionCommand) => void;
  readonly explainerDeclined: boolean;
  readonly declineExplainer: () => void;
}

const ignore = (): undefined => undefined;

const unsupported: MediaSessionsRuntime = {
  source: {
    subscribe: () => ignore,
    command: ignore,
    listenerEnabled: () => Promise.resolve(false),
    openListenerSettings: () => Promise.resolve(false),
    rearm: ignore,
  },
  choose: ignore,
  explainerDeclined: { load: () => false, save: ignore },
};

const liveId = (
  sessions: readonly MediaSessionSnapshot[],
  sessionId: string | undefined,
) =>
  sessions.some((session) => session.sessionId === sessionId)
    ? sessionId
    : undefined;

const mediaSessions = persistedStore<MediaSessionsRuntime, MediaSessionsStore>(
  'Media sessions',
  unsupported,
  ({ source, choose, explainerDeclined }, commit, { getState, setState }) => {
    const settle = (
      sessions: readonly MediaSessionSnapshot[],
      wantedId = getState().pickedId,
    ) => {
      const pickedId = liveId(sessions, wantedId);
      const chosenId = choose(sessions, {
        chosenId: getState().chosenId,
        pickedId,
      });
      setState({ sessions, pickedId, chosenId });
    };
    const refresh = async () => {
      const access = await source.listenerEnabled();
      setState({ access });
      if (!access) settle([]);
      source.rearm();
    };
    return {
      access: undefined,
      sessions: [],
      chosenId: undefined,
      pickedId: undefined,
      watch: () => {
        const unsubscribe = source.subscribe((sessions) => {
          settle(sessions);
        });
        void refresh();
        return unsubscribe;
      },
      refresh,
      openSettings: source.openListenerSettings,
      pick: (sessionId) => {
        const { sessions } = getState();
        if (liveId(sessions, sessionId) !== undefined)
          settle(sessions, sessionId);
      },
      command: (command) => {
        const { chosenId } = getState();
        if (chosenId !== undefined) source.command(chosenId, command);
      },
      explainerDeclined: explainerDeclined.load(),
      declineExplainer: () => {
        commit('explainerDeclined', true, explainerDeclined.save);
      },
    };
  },
);

export const createMediaSessionsStore = mediaSessions.create;
export const configureMediaSessions = mediaSessions.configure;
export const getMediaSessionsStore = mediaSessions.get;
