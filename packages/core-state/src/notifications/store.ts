import { createStore, type StoreApi } from 'zustand/vanilla';

import type { PermissionAnswer } from '../permission.ts';

export type NotificationAsk = 'never' | 'asked' | 'blocked';

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
  readonly retry: () => Promise<void>;
}

export function notificationAction({
  required,
  granted,
  ask,
}: NotificationStatus): NotificationAction {
  if (!required || granted !== false) return 'none';
  return ask === 'blocked' ? 'openSettings' : 'request';
}

const noRuntimePermission: NotificationPermissionSource = {
  required: false,
  granted: () => Promise.resolve(true),
  request: () => Promise.resolve('granted'),
  openSettings: () => undefined,
};

const inMemory: NotificationAskPersistence = {
  load: () => 'never',
  save: () => undefined,
};

export function createNotificationPermissionStore(
  source: NotificationPermissionSource = noRuntimePermission,
  persistence: NotificationAskPersistence = inMemory,
): StoreApi<NotificationPermissionStore> {
  return createStore<NotificationPermissionStore>((set, get) => {
    const remember = (ask: NotificationAsk) => {
      set({ ask });
      persistence.save(ask);
    };
    const request = async () => {
      const answer = await source.request();
      set({ granted: answer === 'granted' });
      if (answer === 'blocked') remember('blocked');
    };
    return {
      required: source.required,
      granted: undefined,
      ask: persistence.load(),
      prompting: false,
      playbackStarted: async () => {
        if (!source.required || get().ask !== 'never') return;
        remember('asked');
        const granted = await source.granted();
        set({ granted, prompting: !granted });
      },
      allow: async () => {
        set({ prompting: false });
        await request();
      },
      notNow: () => {
        set({ prompting: false });
      },
      refresh: async () => {
        if (!source.required) return;
        set({ granted: await source.granted() });
      },
      retry: async () => {
        const action = notificationAction(get());
        if (action === 'request') await request();
        if (action === 'openSettings') source.openSettings();
      },
    };
  });
}

let configured: StoreApi<NotificationPermissionStore> | undefined;

export function configureNotificationPermission(
  source: NotificationPermissionSource,
  persistence: NotificationAskPersistence,
): void {
  if (configured !== undefined) {
    throw new Error(
      'Notification permission store already exists; configure it before first use',
    );
  }
  configured = createNotificationPermissionStore(source, persistence);
}

export function getNotificationPermissionStore(): StoreApi<NotificationPermissionStore> {
  configured ??= createNotificationPermissionStore();
  return configured;
}
