import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APPEARANCE_PREFERENCE_KEYS } from './appearance-preferences';
import {
  OLDEST_RESTORABLE_BACKUP_VERSION,
  type Category,
} from './backup-format';
import {
  openBackupDatabase,
  records,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import { createRouteLatencyRepository } from './route-latency-repository';
import { RIG_PREFERENCE_KEYS } from './rig-preferences';

const fixture = (name: string) =>
  readFileSync(new URL(`./backup-fixtures/${name}`, import.meta.url), 'utf8');

const RESTORED = JSON.parse(fixture('restored-v4-v5.json')) as Record<
  'merged' | 'replaced',
  Record<string, unknown>
>;

const OLD_VERSIONS = [OLDEST_RESTORABLE_BACKUP_VERSION, 5] as const;
const LOCAL_ROUTE = { route: 'speaker', offsetMs: 90, name: null, kind: null };

const restoredAs = async (database: BackupDatabase, expected: object) => {
  const restored = await records(database);
  for (const [category, value] of Object.entries(expected))
    expect(restored[category], category).toEqual(value);
};

async function withLocalSettings(database: BackupDatabase) {
  await database.preferences.set(RIG_PREFERENCE_KEYS.volume, '0.75');
  await database.preferences.set(APPEARANCE_PREFERENCE_KEYS.theme, 'dark');
  await createRouteLatencyRepository(database.handle).save(LOCAL_ROUTE);
}

async function expectLocalSettingsKept(database: BackupDatabase) {
  expect(database.preferences.get(RIG_PREFERENCE_KEYS.volume)).toBe('0.75');
  expect(database.preferences.get(APPEARANCE_PREFERENCE_KEYS.theme)).toBe(
    'dark',
  );
  expect(await createRouteLatencyRepository(database.handle).list()).toEqual([
    LOCAL_ROUTE,
  ]);
}

describe.each(OLD_VERSIONS)('a version %i backup', (version) => {
  const file = fixture(`v${String(version)}.json`);
  const { categories } = JSON.parse(file) as { categories: Category[] };

  it('merges with the default categories as before', async () => {
    const target = openBackupDatabase();
    await withLocalSettings(target);
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.file.categories).not.toContain('rigSettings');
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await restoredAs(target, RESTORED.merged);
    await expectLocalSettingsKept(target);
  });

  it('replaces every category it holds as before, sparing newer settings', async () => {
    const target = openBackupDatabase();
    await seed(target);
    await withLocalSettings(target);
    const plan = unwrap(
      await target.backup.plan(file, { mode: 'replace', categories }),
    );
    expect((await target.backup.apply(plan, { confirmReplace: true })).ok).toBe(
      true,
    );
    await restoredAs(target, RESTORED.replaced);
    await expectLocalSettingsKept(target);
  });
});
