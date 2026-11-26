import type {
  isNotificationListenerEnabled,
  mediaSessionCommand,
  MediaSessionCommand,
  MediaSessionSnapshot,
  openNotificationListenerSettings,
  subscribeMediaSessions,
} from '@kitbag/core-native';

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
}

export interface MediaSessionsRuntime {
  readonly source: MediaSessionsSource;
  readonly choose: SessionChooser;
}

export interface MediaSessionsStore extends SessionChoice {
  readonly access: boolean | undefined;
  readonly sessions: readonly MediaSessionSnapshot[];
  readonly watch: () => () => void;
  readonly refresh: () => Promise<void>;
  readonly openSettings: () => void;
  readonly pick: (sessionId: string) => void;
  readonly command: (command: MediaSessionCommand) => void;
}

const ignore = (): undefined => undefined;

const unsupported: MediaSessionsRuntime = {
  source: {
    subscribe: () => ignore,
    command: ignore,
    listenerEnabled: () => Promise.resolve(false),
    openListenerSettings: ignore,
  },
  choose: ignore,
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
  ({ source, choose }, _commit, { getState, setState }) => {
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
    };
  },
);

export const createMediaSessionsStore = mediaSessions.create;
export const configureMediaSessions = mediaSessions.configure;
export const getMediaSessionsStore = mediaSessions.get;
