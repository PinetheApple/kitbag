export type DatabaseOpenErrorKind =
  | 'newer-version'
  | 'legacy-version'
  | 'migration'
  | 'foreign-keys'
  | 'storage'
  | 'open';

interface DatabaseOpenErrorDetails {
  readonly cause?: unknown;
  readonly fromVersion?: number;
  readonly cleanupErrors?: readonly unknown[];
}

const SQLITE_READONLY = 8;
const SQLITE_IOERR = 10;
const SQLITE_FULL = 13;
const SQLITE_CANTOPEN = 14;
const STORAGE_RESULT_CODES: ReadonlySet<number> = new Set([
  SQLITE_READONLY,
  SQLITE_IOERR,
  SQLITE_FULL,
  SQLITE_CANTOPEN,
]);

// op-sqlite puts the primary SQLite result code on the thrown Error as a number.
function isStorageFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return false;
  const { code } = error;
  return typeof code === 'number' && STORAGE_RESULT_CODES.has(code);
}

function describe(
  kind: DatabaseOpenErrorKind,
  fromVersion: number | undefined,
  cause: unknown,
): string {
  const version =
    fromVersion === undefined ? '' : ` (schema v${String(fromVersion)})`;
  const reason = cause instanceof Error ? `: ${cause.message}` : '';
  return `The database could not be opened: ${kind}${version}${reason}`;
}

export class DatabaseOpenError extends Error {
  override readonly name = 'DatabaseOpenError';
  override readonly cause: unknown;
  readonly fromVersion: number | undefined;
  readonly cleanupErrors: readonly unknown[];

  constructor(
    readonly kind: DatabaseOpenErrorKind,
    { cause, fromVersion, cleanupErrors = [] }: DatabaseOpenErrorDetails = {},
  ) {
    super(describe(kind, fromVersion, cause));
    this.cause = cause;
    this.fromVersion = fromVersion;
    this.cleanupErrors = cleanupErrors;
  }

  static classify(
    kind: DatabaseOpenErrorKind,
    cause: unknown,
    details: Omit<DatabaseOpenErrorDetails, 'cause'> = {},
  ): DatabaseOpenError {
    return new DatabaseOpenError(isStorageFailure(cause) ? 'storage' : kind, {
      ...details,
      cause,
    });
  }
}

export function attempt(work: () => void): unknown[] {
  try {
    work();
    return [];
  } catch (error) {
    return [error];
  }
}
