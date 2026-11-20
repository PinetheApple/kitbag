import { DATABASE_NAME, DatabaseOpenError } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_ERROR_TEXT } from './databaseErrorCopy.ts';

const NO_SPACE_CODE = 'database-copy-no-space';
const UNREADABLE_CODE = 'database-copy-unreadable';

const mocks = vi.hoisted(() => ({
  databaseStatus: vi.fn(),
  retryDatabase: vi.fn(),
  reloadAppAsync: vi.fn(() => Promise.resolve()),
  saveDatabaseCopy: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  getKitbagLibrary: vi.fn(),
}));

vi.mock('@/runtime/database', () => ({
  databaseStatus: mocks.databaseStatus,
  retryDatabase: mocks.retryDatabase,
}));
vi.mock('@kitbag/core-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getKitbagLibrary: mocks.getKitbagLibrary,
  saveDatabaseCopy: mocks.saveDatabaseCopy,
}));
vi.mock('expo', () => ({ reloadAppAsync: mocks.reloadAppAsync }));

const { launchDatabaseError, reopenDatabase, saveDatabaseCopyNotice } =
  await import('./databaseGate.ts');

const REFUSED = new DatabaseOpenError('newer-version', { fromVersion: 99 });
const STILL_FULL = new DatabaseOpenError('storage');
const OPENED = { ok: true, database: { close: mocks.close } };
const TODAY = new Date(2026, 10, 19);

function quietly() {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  mocks.getKitbagLibrary.mockReturnValue({
    getConstants: () => ({
      databaseCopyNoSpace: NO_SPACE_CODE,
      databaseCopyUnreadable: UNREADABLE_CODE,
    }),
  });
});

describe('launchDatabaseError', () => {
  it('is the typed error of a failed open', () => {
    mocks.databaseStatus.mockReturnValue({ ok: false, error: REFUSED });

    expect(launchDatabaseError()).toBe(REFUSED);
  });

  it('is nothing when the database opened', () => {
    mocks.databaseStatus.mockReturnValue(OPENED);

    expect(launchDatabaseError()).toBeUndefined();
  });
});

describe('reopenDatabase', () => {
  it('hands back the new error and stays put when the retry fails', async () => {
    mocks.retryDatabase.mockReturnValue({ ok: false, error: STILL_FULL });

    await expect(reopenDatabase()).resolves.toBe(STILL_FULL);
    expect(mocks.reloadAppAsync).not.toHaveBeenCalled();
  });

  it('relaunches the app after a successful retry, so every runtime starts as on a normal launch', async () => {
    mocks.retryDatabase.mockReturnValue(OPENED);

    await expect(reopenDatabase()).resolves.toBeUndefined();
    expect(mocks.close).toHaveBeenCalledOnce();
    expect(mocks.reloadAppAsync).toHaveBeenCalledOnce();
    expect(mocks.close.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reloadAppAsync.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('still relaunches when the retried connection will not close', async () => {
    quietly();
    mocks.retryDatabase.mockReturnValue(OPENED);
    mocks.close.mockRejectedValueOnce(new Error('busy'));

    await reopenDatabase();

    expect(mocks.reloadAppAsync).toHaveBeenCalledOnce();
  });
});

describe('saveDatabaseCopyNotice', () => {
  it('saves the database under a dated name and confirms it', async () => {
    mocks.saveDatabaseCopy.mockResolvedValue(true);

    await expect(saveDatabaseCopyNotice(TODAY)).resolves.toBe(
      DATABASE_ERROR_TEXT.copySaved,
    );
    expect(mocks.saveDatabaseCopy).toHaveBeenCalledExactlyOnceWith(
      DATABASE_NAME,
      'Kitbag data 2026-11-19.db',
    );
  });

  it('says nothing when the save dialog is cancelled', async () => {
    mocks.saveDatabaseCopy.mockResolvedValue(false);

    await expect(saveDatabaseCopyNotice(TODAY)).resolves.toBeNull();
  });

  it('says the copy was not saved when the write fails', async () => {
    quietly();
    mocks.saveDatabaseCopy.mockRejectedValue(new Error('disk full'));

    await expect(saveDatabaseCopyNotice(TODAY)).resolves.toBe(
      DATABASE_ERROR_TEXT.copyFailed,
    );
  });

  it.each([
    [NO_SPACE_CODE, DATABASE_ERROR_TEXT.copyNoSpace],
    [UNREADABLE_CODE, DATABASE_ERROR_TEXT.copyUnreadable],
  ])('says why no copy could be made for %s', async (code, notice) => {
    quietly();
    mocks.saveDatabaseCopy.mockRejectedValue(
      Object.assign(new Error('no copy'), { code }),
    );

    await expect(saveDatabaseCopyNotice(TODAY)).resolves.toBe(notice);
  });

  it('never asks the user to restart Kitbag to save a copy', () => {
    const notices = [
      DATABASE_ERROR_TEXT.copyFailed,
      DATABASE_ERROR_TEXT.copyNoSpace,
      DATABASE_ERROR_TEXT.copyUnreadable,
    ];

    for (const notice of notices) expect(notice).not.toMatch(/open it again/i);
  });

  it('falls back to the generic notice when the native module cannot be read', async () => {
    quietly();
    mocks.saveDatabaseCopy.mockRejectedValue(
      Object.assign(new Error('no copy'), { code: NO_SPACE_CODE }),
    );
    mocks.getKitbagLibrary.mockImplementation(() => {
      throw new Error('KitbagLibrary is not registered');
    });

    await expect(saveDatabaseCopyNotice(TODAY)).resolves.toBe(
      DATABASE_ERROR_TEXT.copyFailed,
    );
  });
});
