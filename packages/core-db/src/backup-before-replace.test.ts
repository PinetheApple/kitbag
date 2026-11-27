import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  presetValues,
  records,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import { RIG_PREFERENCE_KEYS } from './rig-preferences';

const REPLACE_ALL = { mode: 'replace', categories: CATEGORIES } as const;
const MISSING_SOUND = {
  slot: 0,
  uuid: '00000000-0000-4000-8000-0000000000aa',
  name: 'Rim',
  fileName: 'missing.wav',
};

async function backupFile() {
  const source = openBackupDatabase();
  await seed(source);
  return source.backup.export();
}

async function seededTarget() {
  const target = openBackupDatabase();
  await seed(target);
  await target.presets.create(presetValues('Mine only', null));
  await target.preferences.set(RIG_PREFERENCE_KEYS.volume, '0.5');
  return target;
}

async function replace(target: BackupDatabase, file: string) {
  const plan = unwrap(await target.backup.plan(file, REPLACE_ALL));
  return target.backup.apply(plan, { confirmReplace: true });
}

const portable = (file: string) => {
  const parsed = JSON.parse(file) as Record<string, unknown>;
  delete parsed.exportedAt;
  return parsed;
};

async function rows(target: BackupDatabase) {
  return {
    presets: await target.presets.list(),
    setlists: await target.sets.list(),
    volume: target.preferences.get(RIG_PREFERENCE_KEYS.volume),
  };
}

describe('the copy kept before a replace', () => {
  it('holds every category as it was just before the replace', async () => {
    const target = await seededTarget();
    const before = await records(target);
    expect((await replace(target, await backupFile())).ok).toBe(true);
    const copy = await target.backup.keptBeforeReplace();
    if (copy === null) throw new Error('no copy kept');
    expect(portable(copy)).toEqual(before);
  });

  it('restores the replaced data through a replace of its own', async () => {
    const target = await seededTarget();
    const before = await records(target);
    await replace(target, await backupFile());
    const copy = await target.backup.keptBeforeReplace();
    if (copy === null) throw new Error('no copy kept');
    expect((await replace(target, copy)).ok).toBe(true);
    expect(await records(target)).toEqual(before);
  });

  it('is not taken by a merge or an unconfirmed replace', async () => {
    const target = await seededTarget();
    const file = await backupFile();
    unwrap(await target.backup.apply(unwrap(await target.backup.plan(file))));
    const plan = unwrap(await target.backup.plan(file, REPLACE_ALL));
    expect(await target.backup.apply(plan)).toMatchObject({
      ok: false,
      error: { kind: 'replaceNotConfirmed' },
    });
    expect(await target.backup.keptBeforeReplace()).toBeNull();
  });

  it('aborts the replace without changing anything when it cannot be taken', async () => {
    const target = await seededTarget();
    await target.clickSounds.put(MISSING_SOUND);
    const before = await rows(target);
    const result = await replace(target, await backupFile());
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'snapshotFailed' },
    });
    expect(await rows(target)).toEqual(before);
    expect(await target.backup.keptBeforeReplace()).toBeNull();
  });
});
