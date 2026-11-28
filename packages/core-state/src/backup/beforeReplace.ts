import type { OpenableBackup } from './restore.ts';
import { getBackup, type BackupDeps } from './runtime.ts';

export async function openableBeforeReplace(
  name: string,
  deps: BackupDeps = getBackup(),
): Promise<OpenableBackup | null> {
  const kept = await deps.service().keptBeforeReplace();
  if (kept === null) return null;
  const { contents, categories } = kept;
  return {
    name,
    bytes: new TextEncoder().encode(contents).length,
    contents,
    replace: categories,
  };
}

export async function beforeReplaceTakenAt(
  deps: BackupDeps = getBackup(),
): Promise<string | null> {
  const kept = await deps.service().keptBeforeReplace();
  if (kept === null) return null;
  const { exportedAt } = JSON.parse(kept.contents) as { exportedAt: string };
  return exportedAt;
}
