import {
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  rmSync,
  statfsSync,
} from 'node:fs';
import { join } from 'node:path';

import type { MigrationCopyFiles } from './migration-copy';

const unexpected = (what: string) => () => {
  throw new Error(`no migration copy expected: ${what}`);
};

export const unusedMigrationCopyFiles: MigrationCopyFiles = {
  freeBytes: unexpected('freeBytes'),
  remove: unexpected('remove'),
  replace: unexpected('replace'),
};

export function folderMigrationCopyFiles(
  folder: string,
  overrides: Partial<MigrationCopyFiles> = {},
): MigrationCopyFiles {
  return {
    freeBytes: () => {
      const { bavail, bsize } = statfsSync(folder);
      return bavail * bsize;
    },
    remove: (fileName) => {
      rmSync(join(folder, fileName), { force: true });
    },
    replace: (partName, fileName) => {
      const descriptor = openSync(join(folder, partName), 'r+');
      try {
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      renameSync(join(folder, partName), join(folder, fileName));
    },
    ...overrides,
  };
}
