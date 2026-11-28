import { openableBeforeReplace, restoreStore } from '@kitbag/core-state';

import { BEFORE_REPLACE_NAME } from './backupText.ts';

export function openUndoReplace(): Promise<boolean> {
  return restoreStore
    .getState()
    .open(() => openableBeforeReplace(BEFORE_REPLACE_NAME));
}
