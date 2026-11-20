import { DATABASE_NAME, type DatabaseOpenError } from '@kitbag/core-db';
import { getKitbagLibrary, saveDatabaseCopy } from '@kitbag/core-native';
import { errorCode } from '@kitbag/core-state';
import { reloadAppAsync } from 'expo';

import { databaseStatus, retryDatabase } from '@/runtime/database';

import { DATABASE_ERROR_TEXT, databaseCopyName } from './databaseErrorCopy.ts';

const RELOAD_REASON = 'The database opened on retry';

export function launchDatabaseError(): DatabaseOpenError | undefined {
  const status = databaseStatus();
  return status.ok ? undefined : status.error;
}

export async function reopenDatabase(): Promise<DatabaseOpenError | undefined> {
  const status = retryDatabase();
  if (!status.ok) return status.error;
  try {
    await status.database.close();
  } catch (error) {
    console.warn('[kitbag] retried database not closed', error);
  }
  // Stores built at import loaded defaults from the failed open; a fresh launch rebuilds them all.
  await reloadAppAsync(RELOAD_REASON);
  return undefined;
}

function copyFailureNotices(): ReadonlyMap<string, string> {
  try {
    const constants = getKitbagLibrary().getConstants();
    return new Map([
      [constants.databaseCopyNoSpace, DATABASE_ERROR_TEXT.copyNoSpace],
      [constants.databaseCopyUnreadable, DATABASE_ERROR_TEXT.copyUnreadable],
    ]);
  } catch {
    return new Map();
  }
}

function copyFailureNotice(error: unknown): string {
  const code = errorCode(error);
  const notice = code === null ? undefined : copyFailureNotices().get(code);
  return notice ?? DATABASE_ERROR_TEXT.copyFailed;
}

export async function saveDatabaseCopyNotice(
  now: Date,
): Promise<string | null> {
  try {
    const saved = await saveDatabaseCopy(DATABASE_NAME, databaseCopyName(now));
    return saved ? DATABASE_ERROR_TEXT.copySaved : null;
  } catch (error) {
    console.warn('[kitbag] database copy not saved', error);
    return copyFailureNotice(error);
  }
}
