import { expect } from 'vitest';

import {
  DatabaseOpenError,
  type DatabaseOpenErrorKind,
} from './database-open-error';
import { PRIMARY_RESULT_CODE_MASK } from './sqlite-result-codes';

export function opSqliteError(message: string, extendedCode: number) {
  return Object.assign(new Error(message), {
    code: extendedCode & PRIMARY_RESULT_CODE_MASK,
    extendedCode,
  });
}

export function throwsOpenError(
  kind: DatabaseOpenErrorKind,
  work: () => unknown,
): DatabaseOpenError {
  try {
    work();
  } catch (error) {
    expect(error).toBeInstanceOf(DatabaseOpenError);
    if (!(error instanceof DatabaseOpenError)) throw error;
    expect(error.kind).toBe(kind);
    return error;
  }
  throw new Error(`expected a DatabaseOpenError of kind ${kind}`);
}
