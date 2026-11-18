import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  seed,
  SEEDED_STANDALONE_METRONOME,
  UNRELATED_PREFERENCE,
  unwrap,
  type BackupDatabase,
} from './backup.test-helper';
import { COUNT_IN_PREFERENCE_KEYS } from './count-in-preferences';
import { STANDALONE_METRONOME_KEY } from './standalone-metronome-preference';

const LOCAL_SETTINGS = JSON.stringify({ bpm: 96 });

type ExportedFile = Record<string, unknown> & {
  categories: string[];
  metronomeSettings?: unknown;
};

const standalone = ({ preferences }: BackupDatabase) =>
  preferences.get(STANDALONE_METRONOME_KEY);

async function exported(): Promise<ExportedFile> {
  const source = openBackupDatabase();
  await seed(source);
  return JSON.parse(await source.backup.export()) as ExportedFile;
}

async function withoutMetronome(): Promise<string> {
  const old = await exported();
  old.categories = old.categories.filter((c) => c !== 'metronomeSettings');
  delete old.metronomeSettings;
  return JSON.stringify(old);
}

async function restore(
  target: BackupDatabase,
  file: string,
  options: Parameters<BackupDatabase['backup']['plan']>[1] = {},
) {
  const plan = unwrap(await target.backup.plan(file, options));
  return target.backup.apply(plan, { confirmReplace: true });
}

async function withLocalSettings() {
  const target = openBackupDatabase();
  await target.preferences.set(STANDALONE_METRONOME_KEY, LOCAL_SETTINGS);
  return target;
}

describe('standalone metronome settings in a backup', () => {
  it('round-trip into an empty database under the default categories', async () => {
    const file = JSON.stringify(await exported());
    const target = openBackupDatabase();
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.categories).toContain('metronomeSettings');
    expect((await restore(target, file)).ok).toBe(true);
    expect(standalone(target)).toBe(SEEDED_STANDALONE_METRONOME);
    expect(target.preferences.get(UNRELATED_PREFERENCE)).toBeUndefined();
  });

  it('merge leaves local settings untouched when an older backup lacks them', async () => {
    const target = await withLocalSettings();
    expect((await restore(target, await withoutMetronome())).ok).toBe(true);
    expect(standalone(target)).toBe(LOCAL_SETTINGS);
  });

  it('replace leaves local settings untouched when an older backup lacks them', async () => {
    const file = await withoutMetronome();
    const target = await withLocalSettings();
    const { categories } = JSON.parse(file) as ExportedFile;
    const result = await restore(target, file, {
      mode: 'replace',
      categories: CATEGORIES.filter((c) => categories.includes(c)),
    });
    expect(result.ok).toBe(true);
    expect(standalone(target)).toBe(LOCAL_SETTINGS);
  });

  it('replace swaps in the backup settings and spares other preferences', async () => {
    const file = JSON.stringify(await exported());
    const target = await withLocalSettings();
    await target.preferences.set(UNRELATED_PREFERENCE, 'dark');
    const result = await restore(target, file, {
      mode: 'replace',
      categories: CATEGORIES,
    });
    expect(result.ok).toBe(true);
    expect(standalone(target)).toBe(SEEDED_STANDALONE_METRONOME);
    expect(target.preferences.get(UNRELATED_PREFERENCE)).toBe('dark');
  });

  it('replace with an empty category clears the local settings', async () => {
    const file = await exported();
    file.metronomeSettings = [];
    const target = await withLocalSettings();
    const result = await restore(target, JSON.stringify(file), {
      mode: 'replace',
      categories: ['metronomeSettings'],
    });
    expect(result.ok).toBe(true);
    expect(standalone(target)).toBeUndefined();
  });

  it('merge lists different local settings for review and writes nothing unresolved', async () => {
    const file = JSON.stringify(await exported());
    const target = await withLocalSettings();
    const plan = unwrap(await target.backup.plan(file));
    expect(plan.unresolved).toContainEqual({
      category: 'metronomeSettings',
      key: STANDALONE_METRONOME_KEY,
      label: STANDALONE_METRONOME_KEY,
    });
    expect((await target.backup.apply(plan)).ok).toBe(false);
    expect(standalone(target)).toBe(LOCAL_SETTINGS);
  });

  it.each([
    ['theirs', SEEDED_STANDALONE_METRONOME],
    ['mine', LOCAL_SETTINGS],
  ] as const)(
    'merge resolved as %s keeps that side',
    async (resolution, expected) => {
      const file = JSON.stringify(await exported());
      const target = await withLocalSettings();
      const result = await restore(target, file, {
        categories: ['metronomeSettings'],
        resolutions: {
          metronomeSettings: { [STANDALONE_METRONOME_KEY]: resolution },
        },
      });
      expect(result.ok).toBe(true);
      expect(standalone(target)).toBe(expected);
    },
  );

  it('refuse a key that is not a standalone metronome setting', async () => {
    const file = await exported();
    file.metronomeSettings = [
      { key: COUNT_IN_PREFERENCE_KEYS.bars, value: '2' },
    ];
    const target = openBackupDatabase();
    const plan = await target.backup.plan(JSON.stringify(file));
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.metronomeSettings[0].key' },
    });
  });
});
