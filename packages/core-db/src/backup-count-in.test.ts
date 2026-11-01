import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  seed,
  SEEDED_COUNT_IN,
  UNRELATED_PREFERENCE,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import {
  COUNT_IN_PREFERENCE_KEYS,
  COUNT_IN_STORED_KEYS,
} from './count-in-preferences';

function countIn({ preferences }: BackupDatabase) {
  return Object.fromEntries(
    COUNT_IN_STORED_KEYS.flatMap((key) => {
      const value = preferences.get(key);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

async function restore(
  target: BackupDatabase,
  file: string,
  options: Parameters<BackupDatabase['backup']['plan']>[1] = {},
) {
  const plan = unwrap(await target.backup.plan(file, options));
  return target.backup.apply(plan, { confirmReplace: true });
}

async function exported() {
  const source = openBackupDatabase();
  await seed(source);
  return JSON.parse(await source.backup.export()) as Record<string, unknown> & {
    categories: string[];
    countInSettings?: unknown;
  };
}

describe('count-in settings in a backup', () => {
  it('round-trip into an empty database, and nothing but count-in comes along', async () => {
    const file = JSON.stringify(await exported());
    const target = openBackupDatabase();
    expect((await restore(target, file)).ok).toBe(true);
    expect(countIn(target)).toEqual(SEEDED_COUNT_IN);
    expect(target.preferences.get(UNRELATED_PREFERENCE)).toBeUndefined();
  });

  it('restore with the default categories', async () => {
    const file = JSON.stringify(await exported());
    const target = openBackupDatabase();
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.categories).toContain('countInSettings');
  });

  it('leave local count-in unchanged when restoring an older backup without them', async () => {
    const old = await exported();
    old.categories = old.categories.filter((c) => c !== 'countInSettings');
    delete old.countInSettings;
    const target = openBackupDatabase();
    await target.preferences.set(COUNT_IN_PREFERENCE_KEYS.bars, '4');
    expect((await restore(target, JSON.stringify(old))).ok).toBe(true);
    expect(countIn(target)).toEqual({ [COUNT_IN_PREFERENCE_KEYS.bars]: '4' });
  });

  it('replace drops local count-in the file does not hold and spares other preferences', async () => {
    const file = JSON.stringify(await exported());
    const target = openBackupDatabase();
    await target.preferences.set(COUNT_IN_PREFERENCE_KEYS.sound, '5');
    await target.preferences.set(UNRELATED_PREFERENCE, 'dark');
    const result = await restore(target, file, {
      mode: 'replace',
      categories: CATEGORIES,
    });
    expect(result.ok).toBe(true);
    expect(countIn(target)).toEqual(SEEDED_COUNT_IN);
    expect(target.preferences.get(UNRELATED_PREFERENCE)).toBe('dark');
  });

  it('merge asks before overwriting a different local value', async () => {
    const file = JSON.stringify(await exported());
    const target = openBackupDatabase();
    await target.preferences.set(COUNT_IN_PREFERENCE_KEYS.bars, '4');
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.unresolved).toEqual([
      {
        category: 'countInSettings',
        key: COUNT_IN_PREFERENCE_KEYS.bars,
        label: COUNT_IN_PREFERENCE_KEYS.bars,
      },
    ]);
  });

  it('refuse a key that is not a count-in setting', async () => {
    const file = await exported();
    file.countInSettings = [{ key: UNRELATED_PREFERENCE, value: 'light' }];
    const target = openBackupDatabase();
    const plan = await target.backup.plan(JSON.stringify(file));
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.countInSettings[0].key' },
    });
  });
});
