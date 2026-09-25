import { describe, expect, it } from 'vitest';

import { CATEGORIES } from './backup-format';
import {
  openBackupDatabase,
  presetValues,
  records,
  seed,
} from './backup.test-helper';

async function localAndFile() {
  const source = openBackupDatabase();
  await seed(source);
  const target = openBackupDatabase();
  await target.presets.create(presetValues('Mine', null));
  const mine = await target.sets.create('Mine');
  await target.sets.selectActive(mine.id);
  return { source, target, file: await source.backup.export() };
}

async function replacePlan(
  target: ReturnType<typeof openBackupDatabase>,
  file: string,
) {
  const plan = await target.backup.plan(file, { mode: 'replace' });
  if (!plan.ok) throw new Error(plan.error.kind);
  return plan.value;
}

describe('backup replace', () => {
  it('reports exactly what it will delete and add before any write', async () => {
    const { target, file } = await localAndFile();
    const before = await records(target);
    const plan = await replacePlan(target, file);
    expect(plan.counts.setlists).toMatchObject({
      incoming: 2,
      new: 2,
      deletes: 1,
    });
    expect(plan.counts.songPresets).toMatchObject({ deletes: 1, new: 2 });
    expect(plan.counts.tunings).toMatchObject({ deletes: 0, new: 1 });
    expect(await records(target)).toEqual(before);
  });

  it('writes nothing until the caller confirms', async () => {
    const { target, file } = await localAndFile();
    const before = await records(target);
    const result = await target.backup.apply(await replacePlan(target, file));
    expect(result).toEqual({
      ok: false,
      error: { kind: 'replaceNotConfirmed' },
    });
    expect(await records(target)).toEqual(before);
  });

  it('replaces the selected categories with the file on confirmation', async () => {
    const { source, target, file } = await localAndFile();
    const plan = await target.backup.plan(file, {
      mode: 'replace',
      categories: CATEGORIES,
    });
    if (!plan.ok) throw new Error(plan.error.kind);
    const result = await target.backup.apply(plan.value, {
      confirmReplace: true,
    });
    expect(result.ok).toBe(true);
    expect(await records(target)).toEqual(await records(source));
    expect((await target.sets.active())?.name).toBe('Friday');
  });

  it('unlinks presets from library songs it does not restore', async () => {
    const { target, file } = await localAndFile();
    const result = await target.backup.apply(await replacePlan(target, file), {
      confirmReplace: true,
    });
    expect(result.ok).toBe(true);
    const presets = await target.presets.list();
    expect(presets.map((preset) => preset.librarySongId)).toEqual([null, null]);
  });

  it('relinks history it keeps to the setlists it restores', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    const initial = await target.backup.plan(await source.backup.export(), {
      categories: CATEGORIES,
    });
    if (!initial.ok) throw new Error(initial.error.kind);
    await target.backup.apply(initial.value);
    const before = await records(target);
    const plan = await replacePlan(target, await source.backup.export());
    await target.backup.apply(plan, { confirmReplace: true });
    expect(await records(target)).toEqual(before);
  });

  it('relinks presets it keeps to the library songs it restores', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    const initial = await target.backup.plan(await source.backup.export(), {
      categories: CATEGORIES,
    });
    if (!initial.ok) throw new Error(initial.error.kind);
    await target.backup.apply(initial.value);
    const before = await records(target);
    const plan = await target.backup.plan(await source.backup.export(), {
      mode: 'replace',
      categories: ['librarySongs'],
    });
    if (!plan.ok) throw new Error(plan.error.kind);
    await target.backup.apply(plan.value, { confirmReplace: true });
    expect(await records(target)).toEqual(before);
    const [opener] = await target.presets.list();
    expect(opener?.librarySongId).not.toBeNull();
  });

  it('requires setlists alongside presets, since replacing presets empties them', async () => {
    const { target, file } = await localAndFile();
    const plan = await target.backup.plan(file, {
      mode: 'replace',
      categories: ['songPresets'],
    });
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'missingDependency', requires: 'setlists' },
    });
  });

  it('rolls back every delete and insert when a write fails midway', async () => {
    const { target, file } = await localAndFile();
    const before = await records(target);
    target.handle.connection.exec(
      "CREATE TRIGGER forced BEFORE INSERT ON tunings BEGIN SELECT RAISE(ABORT, 'forced'); END",
    );
    const plan = await target.backup.plan(file, {
      mode: 'replace',
      categories: CATEGORIES,
    });
    if (!plan.ok) throw new Error(plan.error.kind);
    const result = await target.backup.apply(plan.value, {
      confirmReplace: true,
    });
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: 'databaseError',
      },
    });
    expect(await records(target)).toEqual(before);
  });

  it('rolls back a merge when a write fails midway', async () => {
    const { target, file } = await localAndFile();
    const before = await records(target);
    target.handle.connection.exec(
      "CREATE TRIGGER forced BEFORE INSERT ON tunings BEGIN SELECT RAISE(ABORT, 'forced'); END",
    );
    const plan = await target.backup.plan(file);
    if (!plan.ok) throw new Error(plan.error.kind);
    expect(await target.backup.apply(plan.value)).toMatchObject({
      ok: false,
      error: { kind: 'databaseError' },
    });
    expect(await records(target)).toEqual(before);
  });

  it('refuses a replace plan once local rows change', async () => {
    const { target, file } = await localAndFile();
    const plan = await replacePlan(target, file);
    await target.sets.create('Late');
    const result = await target.backup.apply(plan, { confirmReplace: true });
    expect(result).toEqual({ ok: false, error: { kind: 'stalePlan' } });
  });
});
