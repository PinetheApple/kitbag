import type { Removal } from './logic.ts';
import { stemFolderName } from './stemBundleLogic.ts';
import type { SongLibraryDeps } from './store.ts';
import { deleteLeftovers, loadCodes, warn, type Get } from './storeSupport.ts';

export interface ImportTracker {
  readonly track: <T>(work: () => Promise<T>) => Promise<T>;
  readonly idleMark: () => number | null;
  readonly stillIdleSince: (mark: number) => boolean;
}

// A copied folder has no name JS knows until native returns it, so the sweep
// trusts only a window in which no import ran at all.
export function importTracker(): ImportTracker {
  let active = 0;
  let changes = 0;
  return {
    track: async (work) => {
      active += 1;
      changes += 1;
      try {
        return await work();
      } finally {
        active -= 1;
        changes += 1;
      }
    },
    idleMark: () => (active === 0 ? changes : null),
    stillIdleSince: (mark) => active === 0 && changes === mark,
  };
}

export async function sweepOrphanedStemFolders(
  deps: SongLibraryDeps,
  get: Get,
  imports: ImportTracker,
): Promise<void> {
  const mark = imports.idleMark();
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
  if (!imports.stillIdleSince(mark)) return;
  await deleteLeftovers(
    deps.files(),
    orphans.map((name): Removal => ({ kind: 'stemFolder', name })),
    'orphaned stem folders',
  );
}
