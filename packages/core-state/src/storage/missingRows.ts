import type { LibraryRow } from '@kitbag/core-db';
import type { LibraryAvailability } from '@kitbag/core-native';

export interface StoredRowFiles {
  readonly row: LibraryRow;
  readonly audioPaths: readonly string[];
}

export interface MissingFilesSource {
  readonly storedFiles: () => Promise<readonly StoredRowFiles[]>;
  readonly missingFiles: (
    relativePaths: readonly string[],
  ) => Promise<LibraryAvailability>;
}

export interface MissingRowsRemoval extends MissingFilesSource {
  readonly deleteRow: (row: LibraryRow) => Promise<void>;
}

export type RowFiles = 'present' | 'missing' | 'unavailable';

export interface CheckedRow {
  readonly row: LibraryRow;
  readonly files: RowFiles;
}

export interface RowFilesCheck {
  readonly rootAvailable: boolean;
  readonly rows: readonly CheckedRow[];
}

export class DataFolderUnavailableError extends Error {
  constructor() {
    super('The data folder is not mounted, or its location is unknown');
    this.name = 'DataFolderUnavailableError';
  }
}

// A row is missing only when none of its audio is left: a stem set that lost
// one stem still plays the rest, and removing it would delete those too.
function filesOf(
  audioPaths: readonly string[],
  missing: ReadonlySet<string>,
  unavailable: ReadonlySet<string>,
): RowFiles {
  if (audioPaths.some((path) => unavailable.has(path))) return 'unavailable';
  if (audioPaths.length > 0 && audioPaths.every((path) => missing.has(path)))
    return 'missing';
  return 'present';
}

export async function checkRowFiles(
  source: MissingFilesSource,
): Promise<RowFilesCheck> {
  const stored = await source.storedFiles();
  const availability = await source.missingFiles(
    stored.flatMap(({ audioPaths }) => audioPaths),
  );
  const missing = new Set(availability.missing);
  const unavailable = new Set(availability.unavailable);
  return {
    rootAvailable: availability.rootAvailable,
    rows: stored.map(({ row, audioPaths }) => ({
      row,
      files: filesOf(audioPaths, missing, unavailable),
    })),
  };
}

export async function findMissingRows(
  source: MissingFilesSource,
): Promise<LibraryRow[]> {
  const { rootAvailable, rows } = await checkRowFiles(source);
  if (!rootAvailable) throw new DataFolderUnavailableError();
  return rows.filter(({ files }) => files === 'missing').map(({ row }) => row);
}

export async function removeMissingRows(
  removal: MissingRowsRemoval,
): Promise<void> {
  for (const row of await findMissingRows(removal))
    await removal.deleteRow(row);
}
