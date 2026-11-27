import { describe, expect, it } from 'vitest';

import {
  APPEARANCE_PREFERENCE_KEYS,
  HOME_LAYOUT_KEY,
} from './appearance-preferences';
import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  seed,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';

const SEEDED_APPEARANCE: Readonly<Record<string, string>> = {
  [APPEARANCE_PREFERENCE_KEYS.theme]: 'dark',
  [APPEARANCE_PREFERENCE_KEYS.haptics]: '0',
  [APPEARANCE_PREFERENCE_KEYS.keepScreenAwake]: '1',
  [HOME_LAYOUT_KEY]:
    '[{"toolId":"tuner","size":"wide","hidden":false},{"toolId":"stems","size":"small","hidden":true}]',
};

const appearanceKeys = [
  ...Object.values(APPEARANCE_PREFERENCE_KEYS),
  HOME_LAYOUT_KEY,
];

function appearance({ preferences }: BackupDatabase) {
  return Object.fromEntries(
    appearanceKeys.flatMap((key) => {
      const value = preferences.get(key);
      return value === undefined ? [] : [[key, value]];
    }),
  );
}

async function exported() {
  const source = openBackupDatabase();
  await seed(source);
  for (const [key, value] of Object.entries(SEEDED_APPEARANCE))
    await source.preferences.set(key, value);
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

describe('theme, appearance and Home layout in a backup', () => {
  it('round-trip into an empty database with the default categories', async () => {
    const target = openBackupDatabase();
    const plan = unwrap(await target.backup.plan(await exported()));
    expect(plan.categories).toContain('appearanceSettings');
    expect((await target.backup.apply(plan)).ok).toBe(true);
    expect(appearance(target)).toEqual(SEEDED_APPEARANCE);
  });

  it('merge leaves settings the backup does not carry unchanged', async () => {
    const source = openBackupDatabase();
    await source.preferences.set(APPEARANCE_PREFERENCE_KEYS.theme, 'light');
    const target = openBackupDatabase();
    await target.preferences.set(HOME_LAYOUT_KEY, '[]');
    await target.preferences.set(APPEARANCE_PREFERENCE_KEYS.haptics, '1');
    expect((await restore(target, await source.backup.export())).ok).toBe(true);
    expect(appearance(target)).toEqual({
      [APPEARANCE_PREFERENCE_KEYS.theme]: 'light',
      [APPEARANCE_PREFERENCE_KEYS.haptics]: '1',
      [HOME_LAYOUT_KEY]: '[]',
    });
  });

  it('merge asks before overwriting a different local theme', async () => {
    const target = openBackupDatabase();
    await target.preferences.set(APPEARANCE_PREFERENCE_KEYS.theme, 'light');
    const plan = unwrap(await target.backup.plan(await exported()));
    expect(plan.unresolved).toEqual([
      {
        category: 'appearanceSettings',
        key: APPEARANCE_PREFERENCE_KEYS.theme,
        label: APPEARANCE_PREFERENCE_KEYS.theme,
      },
    ]);
  });

  it('replace swaps local appearance for the backup one', async () => {
    const target = openBackupDatabase();
    await target.preferences.set(APPEARANCE_PREFERENCE_KEYS.theme, 'light');
    const result = await restore(target, await exported(), {
      mode: 'replace',
      categories: CATEGORIES,
    });
    expect(result.ok).toBe(true);
    expect(appearance(target)).toEqual(SEEDED_APPEARANCE);
  });
});
