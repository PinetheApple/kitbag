import type { FileWorkTracker } from './fileWork.ts';
import type { Removal } from './logic.ts';
import { stemFolderName } from './stemBundleLogic.ts';
import type { SongLibraryDeps } from './store.ts';
import { deleteLeftovers, loadCodes, warn, type Get } from './storeSupport.ts';

export async function sweepOrphanedStemFolders(
  deps: SongLibraryDeps,
  get: Get,
  fileWork: FileWorkTracker,
): Promise<void> {
  // A copied folder has no name JS knows until native returns it, so the sweep
  // trusts only a window in which no import, delete or Undo ran at all.
  const mark = fileWork.idleMark();
  const codes = loadCodes(deps, get);
  if (mark === null || codes === null) return;
  let orphans: string[];
  try {
    const onDisk = await deps.files().listStemFolders();
    const folders = await deps.records().listStemSetFolders();
    const referenced = new Set(
      folders.map((folder) => stemFolderName(folder, codes.stemsDir)),
    );
    orphans = onDisk.filter((name) => !referenced.has(name));
  } catch (error) {
    warn('stem folder sweep skipped', error);
    return;
  }
  if (!fileWork.stillIdleSince(mark)) return;
  await deleteLeftovers(
    deps.files(),
    orphans.map((name): Removal => ({ kind: 'stemFolder', name })),
    'orphaned stem folders',
  );
}
