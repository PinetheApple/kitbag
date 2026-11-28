import { afterEach, describe, expect, it, vi } from 'vitest';

import { keepBeforeReplace } from './backup-before-replace';

import { CATEGORIES, type Category } from './backup-format';
import {
  openBackupDatabase,
  presetValues,
  records,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import { TEST_BACKUP_RULES } from './backup-rules.test-helper';
import { RIG_PREFERENCE_KEYS } from './rig-preferences';
import { createRouteLatencyRepository } from './route-latency-repository';

const REPLACE_ALL = { mode: 'replace', categories: CATEGORIES } as const;
const TAKEN_AT = '2026-11-27T14:32:00.000Z';
const STORED_AT = '2026-11-28T09:05:00.000Z';
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

async function replace(
  target: BackupDatabase,
  file: string,
  categories: readonly Category[] = CATEGORIES,
) {
  const plan = unwrap(
    await target.backup.plan(file, { mode: 'replace', categories }),
  );
  return target.backup.apply(plan, { confirmReplace: true });
}

async function keptCopy(target: BackupDatabase) {
  const kept = await target.backup.keptBeforeReplace();
  if (kept === null) throw new Error('no copy kept');
  return kept;
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

afterEach(() => {
  vi.useRealTimers();
});

describe('the date of the copy kept before a replace', () => {
  it('is absent before any replace', async () => {
    const target = await seededTarget();
    expect(await target.backup.keptBeforeReplaceAt()).toBeNull();
  });

  it('is stored beside the copy when the replace takes it', async () => {
    const target = await seededTarget();
    const file = await backupFile();
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(TAKEN_AT) });
    await replace(target, file);
    vi.useRealTimers();
    expect(await target.backup.keptBeforeReplaceAt()).toBe(TAKEN_AT);
  });

  it('is read from beside the copy, not from inside it', async () => {
    const target = await seededTarget();
    await replace(target, await backupFile());
    const kept = await keptCopy(target);
    await keepBeforeReplace(target.handle.db, kept, STORED_AT);
    expect(await target.backup.keptBeforeReplaceAt()).toBe(STORED_AT);
  });

  it('falls back to the export time of a copy stored without one', async () => {
    const target = await seededTarget();
    await replace(target, await backupFile());
    const { categories, contents } = await keptCopy(target);
    await keepBeforeReplace(target.handle.db, { categories, contents });
    const { exportedAt } = JSON.parse(contents) as { exportedAt: string };
    expect(await target.backup.keptBeforeReplaceAt()).toBe(exportedAt);
  });

  it('stays out of backups', async () => {
    const target = await seededTarget();
    await replace(target, await backupFile());
    expect(await target.backup.export()).not.toContain('backup_before_replace');
  });
});

describe('the copy kept before a replace', () => {
  it('holds every category as it was just before the replace', async () => {
    const target = await seededTarget();
    const before = await records(target);
    expect((await replace(target, await backupFile())).ok).toBe(true);
    expect(portable((await keptCopy(target)).contents)).toEqual(before);
  });

  it('remembers which categories the replace took', async () => {
    const target = await seededTarget();
    expect((await replace(target, await backupFile(), ['tunings'])).ok).toBe(
      true,
    );
    expect((await keptCopy(target)).categories).toEqual(['tunings']);
  });

  it('restores the replaced data through a replace of its own', async () => {
    const target = await seededTarget();
    const before = await records(target);
    await replace(target, await backupFile());
    const { contents } = await keptCopy(target);
    expect((await replace(target, contents)).ok).toBe(true);
    expect(await records(target)).toEqual(before);
  });

  it('keeps what an undo replaced, so the undo can be undone', async () => {
    const target = await seededTarget();
    await replace(target, await backupFile());
    const replacedIn = await records(target);
    const { contents } = await keptCopy(target);
    expect((await replace(target, contents)).ok).toBe(true);
    expect(portable((await keptCopy(target)).contents)).toEqual(replacedIn);
  });

  it('holds only the latest replace', async () => {
    const target = await seededTarget();
    const file = await backupFile();
    await replace(target, file);
    await target.presets.create(presetValues('Added later', null));
    const beforeSecond = await records(target);
    expect((await replace(target, file)).ok).toBe(true);
    expect(portable((await keptCopy(target)).contents)).toEqual(beforeSecond);
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
      error: { kind: 'snapshotFailed', sound: MISSING_SOUND.name },
    });
    expect(await rows(target)).toEqual(before);
    expect(await target.backup.keptBeforeReplace()).toBeNull();
  });

  it('aborts the replace when the copy would not restore', async () => {
    const target = await seededTarget();
    await createRouteLatencyRepository(target.handle).save({
      route: 'speaker',
      offsetMs: TEST_BACKUP_RULES.latencyOffsetMs.max + 1,
      name: null,
      kind: null,
    });
    const before = await rows(target);
    expect(await replace(target, await backupFile())).toMatchObject({
      ok: false,
      error: { kind: 'snapshotFailed' },
    });
    expect(await rows(target)).toEqual(before);
    expect(await target.backup.keptBeforeReplace()).toBeNull();
  });

  it('keeps the previous copy when a replace fails after taking its own', async () => {
    const target = await seededTarget();
    const file = await backupFile();
    expect((await replace(target, file)).ok).toBe(true);
    const previous = await keptCopy(target);
    await target.presets.create(presetValues('Added later', null));
    const withSound = JSON.parse(file) as Record<string, unknown>;
    withSound.clickSounds = [
      { slot: 0, uuid: MISSING_SOUND.uuid, name: 'Rim', wav: 'UklGRg==' },
    ];
    target.clickSoundFiles.files.write = () =>
      Promise.reject(new Error('disk full'));
    expect((await replace(target, JSON.stringify(withSound))).ok).toBe(false);
    expect(await keptCopy(target)).toEqual(previous);
  });
});
