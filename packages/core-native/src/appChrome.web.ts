import type * as Native from './appChrome.ts';
import type { AppVersion } from './appChromeTypes.ts';

const WEB_APP_VERSION: AppVersion = {
  versionName: 'web',
  versionCode: 0,
};

export const getAppVersion: typeof Native.getAppVersion = () => WEB_APP_VERSION;

export const setAppNightMode: typeof Native.setAppNightMode = () => undefined;

export const setSystemBarAppearance: typeof Native.setSystemBarAppearance =
  () => undefined;
