import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { APPEARANCE_PREFERENCE_KEYS } from './appearance-preferences';
import type { Category, Resolutions } from './backup-format';
import type { ImportOptions } from './backup-plan';
import {
  addFolderSong,
  addStemDeckSong,
  stemSongDatabase,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';
import { records, unwrap } from './backup.test-helper';
import { createRouteLatencyRepository } from './route-latency-repository';
import { RIG_PREFERENCE_KEYS } from './rig-preferences';

const OLD_RELEASES = ['v4-early', 'v4-last', 'v5'] as const;
const LOCAL_ROUTE = { route: 'speaker', offsetMs: 90, name: null, kind: null };
const LOCAL_VOLUME = '0.75';
const LOCAL_THEME = 'dark';
const RENAMED_SINCE_EARLY_V4: Readonly<Record<string, string>> = {
  rampBars: 'rampLength',
};

interface Restored {
  mergeResolutions: Resolutions;
  merged: Record<string, unknown>;
  replaced: Record<string, unknown>;
}

const fixture = (release: string, name: string) =>
  readFileSync(
    new URL(`./backup-fixtures/${release}/${name}`, import.meta.url),
    'utf8',
  );

const categoriesOf = (file: string) =>
  (JSON.parse(file) as { categories: Category[] }).categories;

async function restore(
  target: StemSongDatabase,
  file: string,
  options: ImportOptions,
) {
  const plan = unwrap(await target.backup.plan(file, options));
  return target.backup.apply(plan, { confirmReplace: true });
}

async function withLocalSettings(target: StemSongDatabase) {
  await target.preferences.set(RIG_PREFERENCE_KEYS.volume, LOCAL_VOLUME);
  await target.preferences.set(APPEARANCE_PREFERENCE_KEYS.theme, LOCAL_THEME);
  await createRouteLatencyRepository(target.handle).save(LOCAL_ROUTE);
}

async function localTarget(local: string) {
  const target = stemSongDatabase();
  const categories = categoriesOf(local);
  if (categories.includes('stemSongs')) {
    await addStemDeckSong(target);
    await addFolderSong(target);
  }
  unwrap(await restore(target, local, { mode: 'replace', categories }));
  await withLocalSettings(target);
  return target;
}

const renamed = (record: object) =>
  Object.fromEntries(
    Object.entries(record).map(([field, value]) => [
      RENAMED_SINCE_EARLY_V4[field] ?? field,
      value,
    ]),
  );

async function expectRestoredAs(
  target: StemSongDatabase,
  expected: Record<string, unknown>,
) {
  const actual = await records(target);
  for (const category of categoriesOf(JSON.stringify(expected)))
    expect(actual[category], category).toMatchObject(
      (expected[category] as object[]).map(renamed),
    );
}

async function expectLocalSettingsKept(target: StemSongDatabase) {
  expect(target.preferences.get(RIG_PREFERENCE_KEYS.volume)).toBe(LOCAL_VOLUME);
  expect(target.preferences.get(APPEARANCE_PREFERENCE_KEYS.theme)).toBe(
    LOCAL_THEME,
  );
  expect(await createRouteLatencyRepository(target.handle).list()).toEqual([
    LOCAL_ROUTE,
  ]);
}

describe.each(OLD_RELEASES)('a %s backup', (release) => {
  const file = fixture(release, 'backup.json');
  const local = fixture(release, 'local.json');
  const old = JSON.parse(fixture(release, 'restored.json')) as Restored;

  it('merges into the same data the release that wrote it merged into', async () => {
    const target = await localTarget(local);
    const result = await restore(target, file, {
      resolutions: old.mergeResolutions,
    });
    expect(result.ok).toBe(true);
    await expectRestoredAs(target, old.merged);
    await expectLocalSettingsKept(target);
  });

  it('replaces into the same data the release that wrote it replaced into', async () => {
    const target = await localTarget(local);
    const result = await restore(target, file, {
      mode: 'replace',
      categories: categoriesOf(file),
    });
    expect(result.ok).toBe(true);
    await expectRestoredAs(target, old.replaced);
    await expectLocalSettingsKept(target);
  });
});
