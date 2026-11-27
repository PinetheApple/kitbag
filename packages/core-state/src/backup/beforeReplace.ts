import type { PickedBackup } from '@kitbag/core-native';

import { getBackup, type BackupDeps } from './runtime.ts';

export async function readBeforeReplace(
  name: string,
  deps: BackupDeps = getBackup(),
): Promise<PickedBackup | null> {
  const contents = await deps.service().beforeReplace();
  if (contents === null) return null;
  return { name, bytes: new TextEncoder().encode(contents).length, contents };
}
