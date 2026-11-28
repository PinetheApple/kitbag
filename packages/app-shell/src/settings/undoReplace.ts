import { openableBeforeReplace, restoreStore } from '@kitbag/core-state';

import { BEFORE_REPLACE_NAME } from './backupText.ts';

export async function openUndoReplace(): Promise<boolean> {
  let found = true;
  const opened = await restoreStore.getState().open(async () => {
    const copy = await openableBeforeReplace(BEFORE_REPLACE_NAME);
    found = copy !== null;
    return copy;
  });
  return opened && found;
}
