import type { AppNightMode, AppVersion } from './appChromeTypes.ts';
import { getKitbagCommands } from './NativeKitbagCommands';

export function getAppVersion(): AppVersion {
  const { versionName, versionCode } = getKitbagCommands().getConstants();
  return { versionName, versionCode };
}

export function setAppNightMode(mode: AppNightMode): void {
  getKitbagCommands().setAppNightMode(mode);
}

export function setSystemBarAppearance(light: boolean): void {
  getKitbagCommands().setSystemBarAppearance(light);
}
