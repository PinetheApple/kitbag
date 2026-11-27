import { countLabel } from '@kitbag/core-design';

import { TOOLS_TITLE } from '../settings/toolsText.ts';

const files = (count: number) => countLabel(count, 'file', 'files');

export function turnOnText(
  toolNames: readonly string[],
  count: number,
): string {
  const what = count === 1 ? 'this file' : `these ${files(count)}`;
  return `Turn on ${toolNames.join(' and ')} in ${TOOLS_TITLE} settings to add ${what}.`;
}

export function skippedText(count: number): string {
  return `Only the backup was opened. Share the other ${files(count)} on their own to add them.`;
}

export function unreadableText(count: number): string {
  return count === 1
    ? 'Couldn’t open that file.'
    : `Couldn’t open those ${files(count)}.`;
}

export const RESTORE_BUSY_TEXT =
  'A restore is still running. Open the backup again once it finishes.';
