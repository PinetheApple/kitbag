import { beforeEach, expect, it, vi } from 'vitest';

const library = vi.hoisted(() => ({
  databaseFreeBytes: vi.fn(),
  removeDatabaseCopy: vi.fn(),
  replaceDatabaseCopy: vi.fn(),
}));

vi.mock('./NativeKitbagLibrary', () => ({
  getKitbagLibrary: () => library,
}));

const { databaseFreeBytes, removeDatabaseCopy, replaceDatabaseCopy } =
  await import('./migrationCopies.ts');

beforeEach(() => {
  vi.clearAllMocks();
});

it('returns the free bytes native measured for the named database', () => {
  library.databaseFreeBytes.mockReturnValue(4096);
  expect(databaseFreeBytes('kitbag')).toBe(4096);
  expect(library.databaseFreeBytes).toHaveBeenCalledExactlyOnceWith('kitbag');
});

it('passes a removal through and throws when native refuses it', () => {
  library.removeDatabaseCopy
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(false);
  removeDatabaseCopy('kitbag', 'kitbag.v24.bak');
  expect(library.removeDatabaseCopy).toHaveBeenCalledWith(
    'kitbag',
    'kitbag.v24.bak',
  );
  expect(() => {
    removeDatabaseCopy('kitbag', 'kitbag.v24.bak');
  }).toThrow('kitbag.v24.bak');
});

it('passes a replacement through and throws when native could not make it', () => {
  library.replaceDatabaseCopy
    .mockReturnValueOnce(true)
    .mockReturnValueOnce(false);
  replaceDatabaseCopy('kitbag', 'kitbag.v24.bak.part', 'kitbag.v24.bak');
  expect(library.replaceDatabaseCopy).toHaveBeenCalledWith(
    'kitbag',
    'kitbag.v24.bak.part',
    'kitbag.v24.bak',
  );
  expect(() => {
    replaceDatabaseCopy('kitbag', 'kitbag.v24.bak.part', 'kitbag.v24.bak');
  }).toThrow('kitbag.v24.bak.part');
});
