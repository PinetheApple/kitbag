import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  seed,
  UNRELATED_PREFERENCE,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import { createRouteLatencyRepository } from './route-latency-repository';
import { RIG_PREFERENCE_KEYS } from './rig-preferences';

const SEEDED_RIG: Readonly<Record<string, string>> = {
  [RIG_PREFERENCE_KEYS.volume]: '1.25',
  [RIG_PREFERENCE_KEYS.accentMasks]: '[0,0,2,6,0,0,0,0,0]',
  [RIG_PREFERENCE_KEYS.accentCount]: '3',
};

const WIRED = {
  route: 'wired:7',
  offsetMs: 41.5,
  name: 'USB-C',
  kind: 'wired',
};
const SPEAKER = { route: 'speaker', offsetMs: 120, name: null, kind: null };
const BLUETOOTH = {
  route: 'bt:aa',
  offsetMs: 210,
  name: 'Earbuds',
  kind: 'bluetooth',
};

const rigKeys = Object.values(RIG_PREFERENCE_KEYS);

function rig({ preferences }: BackupDatabase) {
  return Object.fromEntries(
    rigKeys.flatMap((key) => {
      const value = preferences.get(key);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

const routes = (database: BackupDatabase) =>
  createRouteLatencyRepository(database.handle).list();

async function seedRig(database: BackupDatabase) {
  for (const [key, value] of Object.entries(SEEDED_RIG))
    await database.preferences.set(key, value);
  const repository = createRouteLatencyRepository(database.handle);
  await repository.save(WIRED);
  await repository.save(SPEAKER);
}

async function exported() {
  const source = openBackupDatabase();
  await seed(source);
  await seedRig(source);
  return source.backup.export();
}

async function restore(
  target: BackupDatabase,
  file: string,
  options: Parameters<BackupDatabase['backup']['plan']>[1] = {},
) {
  const plan = unwrap(await target.backup.plan(file, options));
  return target.backup.apply(plan, { confirmReplace: true });
}

describe('rig settings in a backup', () => {
  it('round-trip volume, accents and every route latency into an empty database', async () => {
    const target = openBackupDatabase();
    expect((await restore(target, await exported())).ok).toBe(true);
    expect(rig(target)).toEqual(SEEDED_RIG);
    expect(await routes(target)).toEqual(
      expect.arrayContaining([WIRED, SPEAKER]),
    );
    expect(await routes(target)).toHaveLength(2);
  });

  it('restore with the default categories', async () => {
    const target = openBackupDatabase();
    const plan = unwrap(await target.backup.plan(await exported()));
    expect(plan.categories).toContain('rigSettings');
  });

  it('merge leaves rig settings and routes the backup does not carry unchanged', async () => {
    const source = openBackupDatabase();
    await source.preferences.set(RIG_PREFERENCE_KEYS.accentCount, '3');
    await createRouteLatencyRepository(source.handle).save(WIRED);
    const target = openBackupDatabase();
    await target.preferences.set(RIG_PREFERENCE_KEYS.volume, '0.5');
    await createRouteLatencyRepository(target.handle).save(BLUETOOTH);
    expect((await restore(target, await source.backup.export())).ok).toBe(true);
    expect(rig(target)).toEqual({
      [RIG_PREFERENCE_KEYS.volume]: '0.5',
      [RIG_PREFERENCE_KEYS.accentCount]: '3',
    });
    expect(await routes(target)).toEqual(
      expect.arrayContaining([WIRED, BLUETOOTH]),
    );
  });

  it('merge asks before overwriting a route measured differently here', async () => {
    const target = openBackupDatabase();
    await createRouteLatencyRepository(target.handle).save({
      ...WIRED,
      offsetMs: 12,
    });
    const plan = unwrap(await target.backup.plan(await exported()));
    expect(plan.unresolved).toEqual([
      { category: 'rigSettings', key: 'route:wired:7', label: 'USB-C' },
    ]);
  });

  it('replace swaps local rig settings and routes for the backup ones', async () => {
    const target = openBackupDatabase();
    await target.preferences.set(RIG_PREFERENCE_KEYS.volume, '0.5');
    await createRouteLatencyRepository(target.handle).save(BLUETOOTH);
    const result = await restore(target, await exported(), {
      mode: 'replace',
      categories: CATEGORIES,
    });
    expect(result.ok).toBe(true);
    expect(rig(target)).toEqual(SEEDED_RIG);
    expect(await routes(target)).toEqual(
      expect.arrayContaining([WIRED, SPEAKER]),
    );
    expect(await routes(target)).toHaveLength(2);
  });

  it('refuse a key that is not a rig setting', async () => {
    const file = JSON.parse(await exported()) as Record<string, unknown>;
    file.rigSettings = [{ key: UNRELATED_PREFERENCE, value: 'tuner' }];
    const plan = await openBackupDatabase().backup.plan(JSON.stringify(file));
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.rigSettings[0].key' },
    });
  });

  it('refuse a route latency without a finite offset', async () => {
    const file = JSON.parse(await exported()) as Record<string, unknown>;
    file.rigSettings = [{ ...WIRED, offsetMs: 'late' }];
    const plan = await openBackupDatabase().backup.plan(JSON.stringify(file));
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.rigSettings[0].offsetMs' },
    });
  });
});
