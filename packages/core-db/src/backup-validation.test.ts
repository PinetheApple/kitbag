import { describe, expect, it } from 'vitest';

import { CATEGORIES, type ImportFailure } from './backup-format';
import { openBackupDatabase, records, seed } from './backup.test-helper';

type Mutable = Record<string, unknown> & {
  songPresets: Record<string, unknown>[];
  setlists: Record<string, unknown>[];
  practiceSessions: Record<string, unknown>[];
};

async function rejected(
  mutate: (file: Mutable) => void,
): Promise<ImportFailure | undefined> {
  const source = openBackupDatabase();
  await seed(source);
  const file = JSON.parse(await source.backup.export()) as Mutable;
  mutate(file);
  const target = openBackupDatabase();
  const before = await records(target);
  const plan = await target.backup.plan(JSON.stringify(file), {
    categories: CATEGORIES,
  });
  expect(await records(target)).toEqual(before);
  return plan.ok ? undefined : plan.error;
}

const first = <T>(list: T[]): T => {
  const [item] = list;
  if (item === undefined) throw new Error('fixture list empty');
  return item;
};

describe('backup validation', () => {
  it('refuses a newer version by number', async () => {
    expect(await rejected((file) => (file.version = 5))).toEqual({
      kind: 'unsupportedVersion',
      version: 5,
    });
  });

  it('refuses a v3 file by number', async () => {
    expect(await rejected((file) => (file.version = 3))).toEqual({
      kind: 'unsupportedVersion',
      version: 3,
    });
  });

  it('refuses a file that is not a Kitbag backup', async () => {
    expect(await rejected((file) => (file.format = 'other'))).toMatchObject({
      kind: 'malformedFile',
    });
  });

  it('refuses bytes that are not JSON', async () => {
    const target = openBackupDatabase();
    const plan = await target.backup.plan(new TextEncoder().encode('{nope'));
    expect(plan).toEqual({
      ok: false,
      error: { kind: 'malformedFile', reason: 'not valid JSON' },
    });
  });

  it('refuses a malformed UUID with its path', async () => {
    const failure = await rejected((file) => {
      first(file.songPresets).uuid = 'not-a-uuid';
    });
    expect(failure).toEqual({
      kind: 'invalidField',
      path: '$.songPresets[0].uuid',
      reason: 'expected a UUID',
    });
  });

  it('refuses a malformed field', async () => {
    const failure = await rejected((file) => {
      first(file.songPresets).bpm = '120';
    });
    expect(failure).toMatchObject({ path: '$.songPresets[0].bpm' });
  });

  it('refuses a blob that is not base64', async () => {
    const failure = await rejected((file) => {
      first(file.songPresets).accents = '!!!!!!==';
    });
    expect(failure).toEqual({
      kind: 'invalidField',
      path: '$.songPresets[0].accents',
      reason: 'expected base64 bytes',
    });
  });

  it('refuses an accent blob whose length disagrees with the bar', async () => {
    const failure = await rejected((file) => {
      first(file.songPresets).beatsPerBar = 5;
    });
    expect(failure).toEqual({
      kind: 'invalidField',
      path: '$.songPresets[0].accents',
      reason: 'expected 5 bytes',
    });
  });

  it('refuses a setlist that references a preset not in the file', async () => {
    const failure = await rejected((file) => {
      first(file.setlists).presetUuids = [crypto.randomUUID()];
    });
    expect(failure).toMatchObject({
      kind: 'invalidRelationship',
      path: '$.setlists[0].presetUuids[0]',
    });
  });

  it('refuses a session that references a setlist not in the file', async () => {
    const failure = await rejected((file) => {
      first(file.practiceSessions).setlistUuid = crypto.randomUUID();
    });
    expect(failure).toMatchObject({
      kind: 'invalidRelationship',
      path: '$.practiceSessions[0].setlistUuid',
    });
  });

  it('refuses a UUID used twice in one category', async () => {
    const failure = await rejected((file) => {
      file.songPresets.push({ ...first(file.songPresets) });
    });
    expect(failure).toMatchObject({
      kind: 'duplicateIdentity',
      category: 'songPresets',
    });
  });

  it('refuses two active setlists', async () => {
    const failure = await rejected((file) => {
      for (const setlist of file.setlists) setlist.active = true;
    });
    expect(failure).toMatchObject({ kind: 'invalidField', path: '$.setlists' });
  });

  it('refuses a category the file does not contain', async () => {
    const failure = await rejected((file) => {
      delete file.tunings;
      file.categories = CATEGORIES.filter((category) => category !== 'tunings');
    });
    expect(failure).toEqual({ kind: 'categoryNotInFile', category: 'tunings' });
  });

  it('refuses setlists without the presets they reference', async () => {
    const target = openBackupDatabase();
    const source = openBackupDatabase();
    await seed(source);
    const plan = await target.backup.plan(await source.backup.export(), {
      categories: ['setlists'],
    });
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'missingDependency', requires: 'songPresets' },
    });
  });
});
