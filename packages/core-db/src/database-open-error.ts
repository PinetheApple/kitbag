import { STORAGE_RESULT_CODES } from './sqlite-result-codes';

export type DatabaseOpenErrorKind =
  | 'newer-version'
  | 'legacy-version'
  | 'migration'
  | 'foreign-keys'
  | 'storage'
  | 'open';

interface DatabaseOpenErrorDetails {
  readonly cause?: unknown;
  readonly fromVersion?: number | undefined;
  readonly cleanupErrors?: readonly unknown[];
}

// op-sqlite puts the primary SQLite result code on the thrown Error as a number.
function isStorageFailure(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error))
    return false;
  const { code } = error;
  return typeof code === 'number' && STORAGE_RESULT_CODES.has(code);
}

function formatMessage(
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
    super(formatMessage(kind, fromVersion, cause));
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

  withCleanupErrors(errors: readonly unknown[]): DatabaseOpenError {
    if (errors.length === 0) return this;
    return new DatabaseOpenError(this.kind, {
      cause: this.cause,
      fromVersion: this.fromVersion,
      cleanupErrors: [...this.cleanupErrors, ...errors],
    });
  }
}
