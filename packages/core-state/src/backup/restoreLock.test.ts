import {
  openBackupDatabase,
  seed,
} from '@kitbag/core-db/src/backup.test-helper';
import { expect, it, vi } from 'vitest';

import { createClickSoundLock } from '../clickSounds/lock.ts';
import { createRestoreStore } from './restore.ts';
import type { BackupDeps } from './runtime.ts';

it('applies a backup only while it holds the click sound lock', async () => {
  const source = openBackupDatabase();
  await seed(source);
  const contents = await source.backup.export();
  const target = openBackupDatabase();
  const apply = vi.spyOn(target.backup, 'apply');
  const deps: BackupDeps = {
    service: () => target.backup,
    pick: () =>
      Promise.resolve({ name: 'b.json', bytes: contents.length, contents }),
    share: () => Promise.resolve(),
    save: () => Promise.resolve(true),
    afterRestore: () => Promise.resolve(),
  };
  const lock = createClickSoundLock();
  const store = createRestoreStore(() => deps, lock);
  await store.getState().pick();
  let release: () => void = () => undefined;
  const held = lock.run(
    () =>
      new Promise<void>((done) => {
        release = done;
      }),
  );
  const applying = store.getState().apply();
  await new Promise((done) => setTimeout(done, 0));
  expect(apply).not.toHaveBeenCalled();
  release();
  await Promise.all([held, applying]);
  expect(apply).toHaveBeenCalledOnce();
  expect(store.getState().restore.phase).toBe('done');
});
