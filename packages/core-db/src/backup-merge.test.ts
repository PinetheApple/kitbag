import { describe, expect, it } from 'vitest';

import {
  openBackupDatabase,
  presetValues,
  records,
  seed,
  unwrap,
} from './backup.test-helper';

async function divergedPair() {
  const source = openBackupDatabase();
  const seeded = await seed(source);
  const target = openBackupDatabase();
  const initial = unwrap(
    await target.backup.plan(await source.backup.export()),
  );
  await target.backup.apply(initial);
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
    const plan = unwrap(await target.backup.plan(file));
    const result = await target.backup.apply(plan);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'unresolvedConflicts' },
    });
    expect(await records(target)).toEqual(before);
  });

  it('applies theirs and keeps mine per conflict', async () => {
    const { target, seeded, file } = await divergedPair();
    const plan = unwrap(
      await target.backup.plan(file, {
        resolutions: {
          songPresets: { [seeded.opener.uuid]: 'theirs' },
          setlists: { [seeded.acoustic.uuid]: 'mine' },
        },
      }),
    );
    expect(plan.counts.songPresets?.updates).toBe(1);
    expect((await target.backup.apply(plan)).ok).toBe(true);
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
    const plan = unwrap(
      await target.backup.plan(file, {
        resolutions: {
          songPresets: { [seeded.opener.uuid]: 'mine' },
          setlists: { [seeded.acoustic.uuid]: 'mine' },
        },
      }),
    );
    expect((await target.backup.apply(plan)).ok).toBe(true);
    expect((await target.sets.active())?.uuid).toBe(seeded.acoustic.uuid);
  });

  it('refuses a plan the database has moved past', async () => {
    const { target, seeded } = await divergedPair();
    const plan = unwrap(await target.backup.plan(await target.backup.export()));
    const local = (await target.presets.list()).find(
      (preset) => preset.uuid === seeded.closer.uuid,
    );
    await target.presets.update(local?.id ?? -1, { bpm: 60 });
    const result = await target.backup.apply(plan);
    expect(result).toEqual({ ok: false, error: { kind: 'stalePlan' } });
  });
  it('settles after one default-category merge', async () => {
    const source = openBackupDatabase();
    await seed(source);
    const file = await source.backup.export();
    const target = openBackupDatabase();
    const first = unwrap(await target.backup.plan(file));
    expect((await target.backup.apply(first)).ok).toBe(true);
    const second = unwrap(await target.backup.plan(file));
    expect(second.unresolved).toEqual([]);
    for (const counts of Object.values(second.counts))
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
    const first = unwrap(await target.backup.plan(file));
    await target.backup.apply(first);
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
    const plan = unwrap(await target.backup.plan(await source.backup.export()));
    const [preset] = plan.file.records.songPresets;
    if (preset) preset.bpm = 9999;
    const result = await target.backup.apply(plan);
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalidField' },
    });
    expect(await target.presets.list()).toEqual([]);
  });
});
