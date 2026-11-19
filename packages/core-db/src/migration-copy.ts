import { attempt } from './attempt';
import { OLDEST_UPGRADABLE_VERSION, SCHEMA_VERSION } from './migrate';

export interface MigrationCopyFiles {
  freeBytes(): number;
  remove(fileName: string): void;
  replace(partName: string, fileName: string): void;
}

export interface MigrationCopySql {
  exec(sql: string): void;
  value(sql: string): unknown;
}

export type MigrationCopyProblem = 'no-space' | 'copy-failed' | 'prune-failed';

const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
const MARGIN_MIB = 64;
export const MIGRATION_COPY_MARGIN_BYTES = MARGIN_MIB * BYTES_PER_MIB;

const COPY_EXTENSION = '.bak';
export const PART_SUFFIX = '.part';
const PATH_SEPARATOR = '/';

export const migrationCopyName = (databaseName: string, version: number) =>
  `${databaseName}.v${String(version)}${COPY_EXTENSION}`;

const quoted = (text: string) => `'${text.replaceAll("'", "''")}'`;

function report(problem: MigrationCopyProblem, error?: unknown): void {
  console.warn(`[kitbag] database copy before migration: ${problem}`, error);
}

interface DatabaseFile {
  readonly folder: string;
  readonly name: string;
}

function databaseFile(sql: MigrationCopySql): DatabaseFile {
  const path = sql.value(
    "SELECT file FROM pragma_database_list WHERE name = 'main'",
  );
  if (typeof path !== 'string' || !path.includes(PATH_SEPARATOR))
    throw new Error(`The database has no file to copy: ${String(path)}`);
  const split = path.lastIndexOf(PATH_SEPARATOR) + 1;
  return { folder: path.slice(0, split), name: path.slice(split) };
}

export function databaseBytes(sql: MigrationCopySql): number {
  return Number(
    sql.value(
      'SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()',
    ),
  );
}

function measuredFreeBytes(files: MigrationCopyFiles): number {
  const free = files.freeBytes();
  if (!Number.isFinite(free))
    throw new Error(`Free space could not be measured: ${String(free)}`);
  return free;
}

function takeCopy(
  sql: MigrationCopySql,
  files: MigrationCopyFiles,
  database: DatabaseFile,
  fromVersion: number,
): boolean {
  const copyName = migrationCopyName(database.name, fromVersion);
  const partName = copyName + PART_SUFFIX;
  files.remove(partName);
  if (
    measuredFreeBytes(files) <
    databaseBytes(sql) + MIGRATION_COPY_MARGIN_BYTES
  ) {
    report('no-space');
    return false;
  }
  try {
    sql.exec(`VACUUM INTO ${quoted(database.folder + partName)}`);
    files.replace(partName, copyName);
  } catch (error) {
    attempt(() => {
      files.remove(partName);
    });
    throw error;
  }
  return true;
}

function pruneOlderCopies(
  files: MigrationCopyFiles,
  databaseName: string,
  keptVersion: number,
): unknown[] {
  const errors: unknown[] = [];
  for (
    let version = OLDEST_UPGRADABLE_VERSION;
    version < SCHEMA_VERSION;
    version++
  )
    if (version !== keptVersion)
      errors.push(
        ...attempt(() => {
          files.remove(migrationCopyName(databaseName, version));
        }),
      );
  return errors;
}

export function copyBeforeMigration(
  sql: MigrationCopySql,
  files: MigrationCopyFiles,
  fromVersion: number,
): void {
  try {
    const database = databaseFile(sql);
    if (!takeCopy(sql, files, database, fromVersion)) return;
    const [pruneError] = pruneOlderCopies(files, database.name, fromVersion);
    if (pruneError !== undefined) report('prune-failed', pruneError);
  } catch (error) {
    report('copy-failed', error);
  }
}
