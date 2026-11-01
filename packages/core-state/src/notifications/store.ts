import { persistedStore } from '../persistedStore.ts';
import type { PermissionAnswer } from '../permission.ts';

export type NotificationAsk = 'never' | 'asked';

export type NotificationAction = 'none' | 'request' | 'openSettings';

export interface NotificationPermissionSource {
  readonly required: boolean;
  readonly granted: () => Promise<boolean>;
  readonly request: () => Promise<PermissionAnswer>;
  readonly openSettings: () => void;
}

export interface NotificationAskPersistence {
  readonly load: () => NotificationAsk;
  readonly save: (ask: NotificationAsk) => void;
}

export interface NotificationPermissionRuntime {
  readonly source: NotificationPermissionSource;
  readonly persistence: NotificationAskPersistence;
}

export interface NotificationStatus {
  readonly required: boolean;
  readonly granted: boolean | undefined;
  readonly ask: NotificationAsk;
}

export interface NotificationPermissionStore extends NotificationStatus {
  readonly prompting: boolean;
  readonly playbackStarted: () => Promise<void>;
  readonly allow: () => Promise<void>;
  readonly notNow: () => void;
  readonly refresh: () => Promise<void>;
  readonly enable: () => Promise<void>;
}

const ASKED: NotificationAsk = 'asked';

export function notificationAction({
  required,
  granted,
  ask,
}: NotificationStatus): NotificationAction {
  if (!required || granted !== false) return 'none';
  return ask === 'never' ? 'request' : 'openSettings';
}

const unsupported: NotificationPermissionRuntime = {
  source: {
    required: false,
    granted: () => Promise.resolve(true),
    request: () => Promise.resolve('granted'),
    openSettings: () => undefined,
  },
  persistence: { load: () => 'never', save: () => undefined },
};

const notifications = persistedStore<
  NotificationPermissionRuntime,
  NotificationPermissionStore
>(
  'Notification permission',
  unsupported,
  ({ source, persistence }, commit, { getState, setState }) => {
    let offered = false;
    const remember = () => {
      commit('ask', ASKED, persistence.save);
    };
    // A blocked answer may come back with no dialog shown, so the tap must not dead-end.
    const request = async () => {
      remember();
      const answer = await source.request();
      setState({ granted: answer === 'granted' });
      if (answer === 'blocked') source.openSettings();
    };
    return {
      required: source.required,
      granted: undefined,
      ask: persistence.load(),
      prompting: false,
      playbackStarted: async () => {
        if (!source.required || offered || getState().ask !== 'never') return;
        offered = true;
        const granted = await source.granted();
        setState({ granted, prompting: !granted });
        if (granted) remember();
      },
      allow: async () => {
        setState({ prompting: false });
        await request();
      },
      notNow: () => {
        setState({ prompting: false });
        remember();
      },
      refresh: async () => {
        if (!source.required) return;
        setState({ granted: await source.granted() });
      },
      enable: async () => {
        const action = notificationAction(getState());
        if (action === 'request') await request();
        if (action === 'openSettings') source.openSettings();
      },
    };
  },
);

export const createNotificationPermissionStore = notifications.create;
export const configureNotificationPermission = notifications.configure;
export const getNotificationPermissionStore = notifications.get;
