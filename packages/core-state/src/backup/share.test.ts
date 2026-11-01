import { CATEGORIES } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import type { BackupDeps } from './runtime.ts';
import {
  LIBRARY_BACKUP_FILE_NAME,
  setlistBackupFileName,
  shareLibraryBackup,
  shareSetlist,
} from './share.ts';

function deps() {
  const service = {
    summary: vi.fn(),
    export: vi.fn(() => Promise.resolve('{"library":true}')),
    exportSetlist: vi.fn(() => Promise.resolve('{"setlist":true}')),
    plan: vi.fn(),
    apply: vi.fn(),
  };
  return {
    service: () => service,
    pick: vi.fn(),
    share: vi.fn(() => Promise.resolve()),
    afterRestore: vi.fn(),
    calls: service,
  } satisfies BackupDeps & { calls: unknown };
}

describe('setlistBackupFileName', () => {
  it('names the file after the setlist in a path-safe form', () => {
    expect(setlistBackupFileName('Wedding set')).toBe(
      'kitbag_setlist_wedding-set.json',
    );
    expect(setlistBackupFileName('  Jazz / Standards!! ')).toBe(
      'kitbag_setlist_jazz-standards.json',
    );
  });

  it('falls back when nothing path-safe is left', () => {
    expect(setlistBackupFileName('★★★')).toBe('kitbag_setlist.json');
  });

  it('bounds a long name', () => {
    expect(setlistBackupFileName('a'.repeat(300)).length).toBeLessThanOrEqual(
      128,
    );
  });
});

describe('sharing', () => {
  it('backs up every category through the share sheet', async () => {
    const d = deps();
    await shareLibraryBackup(d);
    expect(d.calls.export).toHaveBeenCalledWith(CATEGORIES);
    expect(d.share).toHaveBeenCalledExactlyOnceWith(
      LIBRARY_BACKUP_FILE_NAME,
      '{"library":true}',
    );
  });

  it('exports one setlist by its identity', async () => {
    const d = deps();
    await shareSetlist({ uuid: 'abc', name: 'Wedding set' }, d);
    expect(d.calls.exportSetlist).toHaveBeenCalledWith('abc');
    expect(d.share).toHaveBeenCalledExactlyOnceWith(
      'kitbag_setlist_wedding-set.json',
      '{"setlist":true}',
    );
  });
});
