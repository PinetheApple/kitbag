import {
  countLabel,
  type FeedbackTone,
  type IconName,
} from '@kitbag/core-design';
import {
  INSTALL_FAILURE,
  type ToolDataUsage,
  type ToolJob,
} from '@kitbag/core-state';

import { formatBytes, formatBytesOf } from './bytes.ts';
import { INSTALLED_CARD, type PageCard } from './toolPageModel.ts';
import { joined } from './toolsText.ts';

export const NOT_INSTALLED_BADGE = 'Not installed';
export const INSTALLED_BADGE = 'Installed';
export const ON_THIS_PHONE_LABEL = 'On this phone';
export const DETAILS_LABEL = 'Details';
export const KEPT_LABEL = 'Kept from before';
export const ON_LABEL = 'On';
export const TOOL_SIZE_LABEL = 'Tool';
export const DATA_LABEL = 'Its data';
export const VERSION_LABEL = 'Version';
export const DOWNLOAD_SIZE_LABEL = 'Download size';
export const BUILT_FOR_LABEL = 'Built for';
export const SOURCE_LABEL = 'Source';
export const SIGNED_BY_LABEL = 'Signed by';
export const SOURCE_VALUE = 'Kitbag releases on GitHub';
export const SIGNED_BY_VALUE = 'Kitbag';
export const NO_DATA_YET = 'None yet';
export const KEPT_BRINGS_BACK = 'Installing brings them back.';
export const DELETE_DATA = 'Delete';

export const DOWNLOADING = 'Downloading';
export const CHECKING = 'Checking the signature';
export const THEN_INSTALLING = 'Then installing';
export const INSTALLING = 'Installing';
export const CANCEL = 'Cancel';
export const TRY_AGAIN = 'Try again';
export const OPEN_NOW = 'Open now';
export const DONE = 'Done';
export const REMOVE = 'Remove';
export const REMOVE_AND_DELETE = 'Remove and delete';
export const ALSO_DELETE_DATA = 'Also delete its data';

export function itemCount(items: number): string {
  return countLabel(items, 'item', 'items');
}

export function dataValue(data: ToolDataUsage): string {
  return data.items === 0
    ? NO_DATA_YET
    : joined(formatBytes(data.bytes), itemCount(data.items));
}

export function builtForValue(hostVersionName: string): string {
  return `This Kitbag (${hostVersionName})`;
}

export function installLabel(sizeBytes: number): string {
  return joined('Install', formatBytes(sizeBytes));
}

const PERCENT = 100;

export function progressPercent(job: ToolJob): number | null {
  return job.totalBytes > 0
    ? (job.receivedBytes / job.totalBytes) * PERCENT
    : null;
}

export interface CardText {
  readonly tone: FeedbackTone;
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
}

const NOTHING_INSTALLED = 'Nothing was installed.';

function droppedBody(job: ToolJob | undefined): string {
  if (job === undefined || job.totalBytes <= 0)
    return `The connection dropped. ${NOTHING_INSTALLED}`;
  return `The connection dropped at ${formatBytesOf(job.receivedBytes, job.totalBytes)}. ${NOTHING_INSTALLED}`;
}

export function cardText(
  card: PageCard,
  name: string,
  job: ToolJob | undefined,
): CardText {
  switch (card) {
    case INSTALLED_CARD:
      return {
        tone: 'success',
        icon: 'success',
        title: 'Installed',
        body: `${name} is on Home, after your other tiles. Move it with Edit on Home.`,
      };
    case INSTALL_FAILURE.check:
      return {
        tone: 'danger',
        icon: 'certificateChanged',
        title: 'Not installed: the check failed',
        body: `The file was not signed by Kitbag, or it changed on the way. Kitbag deleted it. ${NOTHING_INSTALLED}`,
      };
    case INSTALL_FAILURE.download:
      return {
        tone: 'danger',
        icon: 'error',
        title: 'Download stopped',
        body: droppedBody(job),
      };
    case INSTALL_FAILURE.noSpace:
      return {
        tone: 'warning',
        icon: 'storage',
        title: 'Not enough space',
        body: `${name} needs ${formatBytes(job?.neededBytes ?? 0)} to install. This phone has ${formatBytes(job?.freeBytes ?? 0)} free. Free up space on the phone, then try again.`,
      };
    case INSTALL_FAILURE.offline:
      return {
        tone: 'warning',
        icon: 'wifiOff',
        title: 'No connection',
        body: 'Installed tools work as usual. Connect to install this one.',
      };
    case INSTALL_FAILURE.generic:
      return {
        tone: 'danger',
        icon: 'error',
        title: NOT_INSTALLED_BADGE,
        body: `Kitbag could not install this tool. ${NOTHING_INSTALLED}`,
      };
  }
}

export function removeTitle(name: string): string {
  return `Remove ${name}?`;
}

export function removeBody(items: number, deleting: boolean): string {
  const gone = 'It is removed from this phone';
  if (items === 0) return `${gone} and its tile leaves Home.`;
  const one = items === 1;
  if (deleting)
    return `${gone}, its tile leaves Home, and its ${itemCount(items)} ${one ? 'is' : 'are'} deleted.`;
  return `${gone} and its tile leaves Home. Your ${itemCount(items)} ${one ? 'stays' : 'stay'}, so installing it again brings ${one ? 'it' : 'them'} back.`;
}

export const DELETED_FOREVER = 'Deleted items cannot be recovered.';
