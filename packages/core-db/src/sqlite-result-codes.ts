export const SQLITE_READONLY = 8;
export const SQLITE_IOERR = 10;
export const SQLITE_FULL = 13;
export const SQLITE_CANTOPEN = 14;
export const SQLITE_NOTADB = 26;
export const SQLITE_IOERR_FSYNC = 1034;
export const SQLITE_CONSTRAINT_NOTNULL = 1299;
export const PRIMARY_RESULT_CODE_MASK = 0xff;

export const STORAGE_RESULT_CODES: ReadonlySet<number> = new Set([
  SQLITE_READONLY,
  SQLITE_IOERR,
  SQLITE_FULL,
  SQLITE_CANTOPEN,
]);
