import type { LibraryRow } from '@kitbag/core-db';

export interface StoredRowFiles {
  readonly row: LibraryRow;
  readonly audioPaths: readonly string[];
}

export interface MissingFilesSource {
  readonly storedFiles: () => Promise<readonly StoredRowFiles[]>;
  readonly missingFiles: (
    relativePaths: readonly string[],
  ) => Promise<readonly string[]>;
}

export interface MissingRowsRemoval extends MissingFilesSource {
  readonly deleteRow: (row: LibraryRow) => Promise<void>;
}

// A row is missing only when none of its audio is left: a stem set that lost
// one stem still plays the rest, and removing it would delete those too.
export async function findMissingRows(
  source: MissingFilesSource,
): Promise<LibraryRow[]> {
  const stored = await source.storedFiles();
  const missing = new Set(
    await source.missingFiles(stored.flatMap(({ audioPaths }) => audioPaths)),
  );
  return stored
    .filter(
      ({ audioPaths }) =>
        audioPaths.length > 0 && audioPaths.every((path) => missing.has(path)),
    )
    .map(({ row }) => row);
}

export async function removeMissingRows(
  removal: MissingRowsRemoval,
): Promise<void> {
  for (const row of await findMissingRows(removal))
    await removal.deleteRow(row);
}
