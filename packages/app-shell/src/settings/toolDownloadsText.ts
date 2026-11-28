import type { IconName } from '@kitbag/core-design';
import { KB_TOOL_DOWNLOADS } from '@kitbag/core-native';

export const TOOL_DOWNLOADS_TITLE = 'Tool downloads';
export const DOWNLOADS_LABEL = 'Downloads';
export const OPT_IN_HEADLINE = 'Turn on tool downloads?';
export const OPT_IN_INTRO =
  'Most tools are not part of the app. You download the ones you want.';
export const OPT_IN_HINT =
  'You can turn this off any time in Settings, under Tools.';
export const TURN_ON_DOWNLOADS = 'Turn on downloads';
export const NOT_NOW = 'Not now';

export interface OptInPoint {
  readonly icon: IconName;
  readonly text: string;
}

export const OPT_IN_POINTS: readonly OptInPoint[] = [
  {
    icon: 'saveInto',
    text: 'Tools download from Kitbag releases on GitHub, and only when you tap Install or Update.',
  },
  {
    icon: 'trusted',
    text: 'Each tool is signed by Kitbag. The app checks the signature and the file before it installs anything, and refuses a tool that fails.',
  },
  {
    icon: 'analyzing',
    text: 'Installed tools usually keep working when Kitbag updates. Sometimes a Kitbag update needs them updated too; that downloads when you tap Update.',
  },
  {
    icon: 'info',
    text: 'Once downloads are on, Kitbag checks for updates only when you open Settings, Tools.',
  },
];

export const TURN_OFF_TITLE = 'Turn off tool downloads?';
export const TURN_OFF_BODY =
  'Kitbag stops downloading tools and checking for updates. Installed tools keep working. If a Kitbag update needs them updated too, that waits until downloads are back on. You can still remove them.';
export const TURN_OFF = 'Turn off';
export const CANCEL = 'Cancel';

export const DOWNLOADS_ON_HINT =
  'Kitbag goes online only to install or update.';
export const DOWNLOADS_OFF_HINT =
  'Installed tools keep working. If a Kitbag update needs them updated, that waits until downloads are on.';

export function downloadsValue(downloads: KB_TOOL_DOWNLOADS): string {
  return downloads === KB_TOOL_DOWNLOADS.on ? 'On' : 'Off';
}

export function downloadsHint(downloads: KB_TOOL_DOWNLOADS): string {
  return downloads === KB_TOOL_DOWNLOADS.on
    ? DOWNLOADS_ON_HINT
    : DOWNLOADS_OFF_HINT;
}
