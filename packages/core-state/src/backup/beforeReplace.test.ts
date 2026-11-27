import {
  openBackupDatabase,
  presetValues,
  seed,
  unwrap,
} from '@kitbag/core-db/src/backup.test-helper';
import { CATEGORIES } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { readBeforeReplace } from './beforeReplace.ts';
import { createRestoreStore } from './restore.ts';
import type { BackupDeps } from './runtime.ts';

const COPY_NAME = 'Before replace';

function deps(service: BackupDeps['service']): BackupDeps {
  return {
    service,
    pick: () => Promise.resolve(null),
    share: () => Promise.resolve(),
    save: () => Promise.resolve(true),
    afterRestore: vi.fn(() => Promise.resolve()),
  };
}

describe('the copy kept before a replace', () => {
  it('reads as nothing before any replace', async () => {
    const target = openBackupDatabase();
    expect(
      await readBeforeReplace(
        COPY_NAME,
        deps(() => target.backup),
      ),
    ).toBeNull();
  });

  it('opens in the restore review and puts the replaced songs back', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    await target.presets.create(presetValues('Mine only', null));
    const plan = unwrap(
      await target.backup.plan(await source.backup.export(), {
        mode: 'replace',
        categories: CATEGORIES,
      }),
    );
    unwrap(await target.backup.apply(plan, { confirmReplace: true }));
    const backup = deps(() => target.backup);
    const store = createRestoreStore(() => backup);

    await store.getState().open(() => readBeforeReplace(COPY_NAME, backup));
    expect(store.getState().restore).toMatchObject({
      phase: 'review',
      source: { name: COPY_NAME },
    });
    await store.getState().setMode('replace');
    await store.getState().apply('replace');

    expect(store.getState().restore.phase).toBe('done');
    expect((await target.presets.list()).map(({ name }) => name)).toEqual([
      'Mine only',
    ]);
  });
});
