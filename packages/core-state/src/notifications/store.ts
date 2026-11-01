import { persistedStore } from '../persistedStore.ts';
import type { PermissionAnswer } from '../permission.ts';

export const NOTIFICATION_ASK = {
  never: 'never',
  declined: 'declined',
  asked: 'asked',
} as const;

export type NotificationAsk =
  (typeof NOTIFICATION_ASK)[keyof typeof NOTIFICATION_ASK];

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

export function notificationAction({
  required,
  granted,
  ask,
}: NotificationStatus): NotificationAction {
  if (!required || granted !== false) return 'none';
  return ask === NOTIFICATION_ASK.asked ? 'openSettings' : 'request';
}

const unsupported: NotificationPermissionRuntime = {
  source: {
    required: false,
    granted: () => Promise.resolve(true),
    request: () => Promise.resolve('granted'),
    openSettings: () => undefined,
  },
  persistence: { load: () => NOTIFICATION_ASK.never, save: () => undefined },
};

const notifications = persistedStore<
  NotificationPermissionRuntime,
  NotificationPermissionStore
>(
  'Notification permission',
  unsupported,
  ({ source, persistence }, commit, { getState, setState }) => {
    let offered = false;
    const remember = (ask: NotificationAsk) => {
      commit('ask', ask, persistence.save);
    };
    const request = async () => {
      const answer = await source.request();
      remember(NOTIFICATION_ASK.asked);
      setState({ granted: answer === 'granted' });
      if (answer === 'blocked') source.openSettings();
    };
    return {
      required: source.required,
      granted: undefined,
      ask: persistence.load(),
      prompting: false,
      playbackStarted: async () => {
        if (
          !source.required ||
          offered ||
          getState().ask !== NOTIFICATION_ASK.never
        )
          return;
        offered = true;
        const granted = await source.granted();
        setState({ granted, prompting: !granted });
        if (granted) remember(NOTIFICATION_ASK.asked);
      },
      allow: async () => {
        setState({ prompting: false });
        await request();
      },
      notNow: () => {
        setState({ prompting: false });
        remember(NOTIFICATION_ASK.declined);
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
