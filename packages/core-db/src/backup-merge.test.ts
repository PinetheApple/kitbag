import { describe, expect, it } from 'vitest';

import {
  openBackupDatabase,
  presetValues,
  records,
  seed,
} from './backup.test-helper';

async function divergedPair() {
  const source = openBackupDatabase();
  const seeded = await seed(source);
  const target = openBackupDatabase();
  const initial = await target.backup.plan(await source.backup.export());
  if (!initial.ok) throw new Error(initial.error.kind);
  await target.backup.apply(initial.value);
  await source.presets.update(seeded.opener.id, { bpm: 90 });
  await source.sets.rename(seeded.acoustic.id, 'Unplugged');
  await source.presets.create(presetValues('Encore', null));
  return { source, target, seeded, file: await source.backup.export() };
}

describe('backup merge', () => {
  it('defaults to setlists, presets and tunings; history and library off', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    const plan = await target.backup.plan(await source.backup.export());
    expect(plan.ok && plan.value.mode).toBe('merge');
    expect(plan.ok && plan.value.categories).toEqual([
      'songPresets',
      'setlists',
      'tunings',
    ]);
  });

  it('counts new, unchanged and conflicting items before any write', async () => {
    const { target, seeded, file } = await divergedPair();
    const before = await records(target);
    const plan = await target.backup.plan(file);
    expect(plan.ok && plan.value.counts.songPresets).toEqual({
      incoming: 3,
      new: 1,
      unchanged: 1,
      updates: 0,
      deletes: 0,
      conflicts: [
        { category: 'songPresets', key: seeded.opener.uuid, label: 'Opener' },
      ],
    });
    expect(plan.ok && plan.value.counts.setlists?.conflicts).toEqual([
      { category: 'setlists', key: seeded.acoustic.uuid, label: 'Unplugged' },
    ]);
    expect(await records(target)).toEqual(before);
  });

  it('refuses to apply while any conflict is unresolved, writing nothing', async () => {
    const { target, file } = await divergedPair();
    const before = await records(target);
    const plan = await target.backup.plan(file);
    if (!plan.ok) throw new Error(plan.error.kind);
    const result = await target.backup.apply(plan.value);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unresolvedConflicts' },
    });
    expect(await records(target)).toEqual(before);
  });

  it('applies theirs and keeps mine per conflict', async () => {
    const { target, seeded, file } = await divergedPair();
    const plan = await target.backup.plan(file, {
      resolutions: {
        songPresets: { [seeded.opener.uuid]: 'theirs' },
        setlists: { [seeded.acoustic.uuid]: 'mine' },
      },
    });
    if (!plan.ok) throw new Error(plan.error.kind);
    expect(plan.value.counts.songPresets?.updates).toBe(1);
    expect((await target.backup.apply(plan.value)).ok).toBe(true);
    const presets = await target.presets.list();
    expect(presets.map((preset) => [preset.name, preset.bpm])).toEqual([
      ['Opener', 90],
      ['Closer', 128.5],
      ['Encore', 128.5],
    ]);
    expect((await target.sets.list()).map((setlist) => setlist.name)).toEqual([
      'Friday',
      'Acoustic',
    ]);
  });

  it('keeps the local active setlist when merging', async () => {
    const { target, seeded, file } = await divergedPair();
    await target.sets.selectActive(null);
    const acoustic = (await target.sets.list()).find(
      (setlist) => setlist.uuid === seeded.acoustic.uuid,
    );
    await target.sets.selectActive(acoustic?.id ?? -1);
    const plan = await target.backup.plan(file, {
      resolutions: {
        songPresets: { [seeded.opener.uuid]: 'mine' },
        setlists: { [seeded.acoustic.uuid]: 'mine' },
      },
    });
    if (!plan.ok) throw new Error(plan.error.kind);
    expect((await target.backup.apply(plan.value)).ok).toBe(true);
    expect((await target.sets.active())?.uuid).toBe(seeded.acoustic.uuid);
  });

  it('refuses a plan the database has moved past', async () => {
    const { target, seeded } = await divergedPair();
    const plan = await target.backup.plan(await target.backup.export());
    if (!plan.ok) throw new Error(plan.error.kind);
    const local = (await target.presets.list()).find(
      (preset) => preset.uuid === seeded.closer.uuid,
    );
    await target.presets.update(local?.id ?? -1, { bpm: 60 });
    const result = await target.backup.apply(plan.value);
    expect(result).toEqual({ ok: false, error: { kind: 'stalePlan' } });
  });
  it('settles after one default-category merge', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await source.backup.export();
    const target = openBackupDatabase();
    const first = await target.backup.plan(file);
    if (!first.ok) throw new Error(first.error.kind);
    expect((await target.backup.apply(first.value)).ok).toBe(true);
    const second = await target.backup.plan(file);
    if (!second.ok) throw new Error(second.error.kind);
    expect(second.value.unresolved).toEqual([]);
    for (const counts of Object.values(second.value.counts))
      expect(counts).toMatchObject({
        new: 0,
        conflicts: [],
        incoming: counts.unchanged,
      });
  });

  it('matches UUIDs regardless of case', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await source.backup.export();
    const target = openBackupDatabase();
    const first = await target.backup.plan(file);
    if (!first.ok) throw new Error(first.error.kind);
    await target.backup.apply(first.value);
    const upper = file.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, (uuid) =>
      uuid.toUpperCase(),
    );
    const second = await target.backup.plan(upper);
    expect(second.ok && second.value.counts.songPresets).toMatchObject({
      new: 0,
      unchanged: 2,
    });
  });

  it('refuses a plan whose file was edited after planning', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const target = openBackupDatabase();
    const plan = await target.backup.plan(await source.backup.export());
    if (!plan.ok) throw new Error(plan.error.kind);
    const [preset] = plan.value.file.records.songPresets;
    if (preset) preset.bpm = 9999;
    const result = await target.backup.apply(plan.value);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalidField' },
    });
    expect(await target.presets.list()).toEqual([]);
  });
});
