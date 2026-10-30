import type { AppNightMode, AppVersion } from './appNightMode.ts';
import { getKitbagCommands } from './NativeKitbagCommands';

export function getAppVersion(): AppVersion {
  const { versionName, versionCode } = getKitbagCommands().getConstants();
  return { versionName, versionCode };
}

export function setAppNightMode(mode: AppNightMode): void {
  const commands = getKitbagCommands();
  const native = commands.getConstants();
  const wire: Readonly<Record<AppNightMode, string>> = {
    system: native.nightModeSystem,
    dark: native.nightModeDark,
    light: native.nightModeLight,
  };
  commands.setAppNightMode(wire[mode]);
}

export function setSystemBarAppearance(light: boolean): void {
  getKitbagCommands().setSystemBarAppearance(light);
}
