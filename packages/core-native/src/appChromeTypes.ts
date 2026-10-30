import type { KitbagCommandsConstants } from './NativeKitbagCommands';

export type AppNightMode = 'system' | 'dark' | 'light';

export type AppVersion = Pick<
  KitbagCommandsConstants,
  'versionName' | 'versionCode'
>;
