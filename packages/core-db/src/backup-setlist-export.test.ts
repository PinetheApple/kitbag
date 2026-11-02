import { describe, expect, it } from 'vitest';

import { parseBackup } from './backup-parse';
import {
  openBackupDatabase,
  presetValues,
  seed,
  unwrap,
} from './backup.test-helper';

describe('single-setlist export', () => {
  it('carries the setlist and only the presets it lists, by identity', async () => {
    const source = openBackupDatabase();
    const { friday, opener, closer } = await seed(source);
    await source.presets.create(presetValues('Not listed', null));

    const file = parseBackup(await source.backup.exportSetlist(friday.uuid));

    expect(file.categories).toEqual(['songPresets', 'setlists']);
    expect(file.records.setlists).toEqual([
      {
        uuid: friday.uuid,
        name: 'Friday',
        active: false,
        presetUuids: [closer.uuid, opener.uuid],
      },
    ]);
    expect(file.records.songPresets.map((p) => p.uuid).sort()).toEqual(
      [opener.uuid, closer.uuid].sort(),
    );
    expect(file.records.tunings).toEqual([]);
    expect(file.records.practiceSessions).toEqual([]);
  });

  it('lists a preset the setlist repeats once', async () => {
    const source = openBackupDatabase();
    const { acoustic, opener } = await seed(source);
    await source.sets.add(acoustic.id, opener.id);

    const file = parseBackup(await source.backup.exportSetlist(acoustic.uuid));

    expect(file.records.setlists[0]?.presetUuids).toEqual([
      opener.uuid,
      opener.uuid,
    ]);
    expect(file.records.songPresets).toHaveLength(1);
  });

  it('merges into another library as the same setlist, twice without duplicating', async () => {
    const source = openBackupDatabase();
    const { friday } = await seed(source);
    const text = await source.backup.exportSetlist(friday.uuid);
    const target = openBackupDatabase();

    unwrap(await target.backup.apply(unwrap(await target.backup.plan(text))));
    const again = unwrap(await target.backup.plan(text));

    expect(again.counts.setlists).toMatchObject({ new: 0, unchanged: 1 });
    expect(again.counts.songPresets).toMatchObject({ new: 0, unchanged: 2 });
  });

  it('refuses a setlist that does not exist', async () => {
    const source = openBackupDatabase();
    await seed(source);

    await expect(
      source.backup.exportSetlist('00000000-0000-4000-8000-000000000000'),
    ).rejects.toThrow();
  });
});
