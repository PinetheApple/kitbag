import { describe, expect, it } from 'vitest';

import { parseBackup } from './backup-parse';
import { openBackupDatabase, presetValues, unwrap } from './backup.test-helper';
import { insertStemSet } from './stem-entries.test-helper';

async function mixedSetlist() {
  const source = openBackupDatabase();
  const opener = await source.presets.create(presetValues('Opener', null));
  const stem = await insertStemSet(source.handle.db, 'Redbone');
  const gig = await source.sets.create('Gig');
  await source.sets.add(gig.id, opener.id);
  await source.sets.addStemSet(gig.id, stem);
  return { source, opener, gig };
}

describe('a setlist holding a stem song', () => {
  it('backs up and restores its metronome songs, leaving the stem song out', async () => {
    const { source, opener } = await mixedSetlist();
    const text = await source.backup.export();
    expect(() => parseBackup(text)).not.toThrow();
    expect(parseBackup(text).records.setlists[0]?.presetUuids).toEqual([
      opener.uuid,
    ]);

    const target = openBackupDatabase();
    unwrap(await target.backup.apply(unwrap(await target.backup.plan(text))));
    const [restored] = await target.sets.list();
    if (restored === undefined) throw new Error('setlist not restored');
    const items = await target.sets.items(restored.id);
    const presets = await target.presets.list();
    expect(
      items.map(
        (item) => presets.find((p) => p.id === item.songPresetId)?.uuid,
      ),
    ).toEqual([opener.uuid]);
  });

  it('exports on its own with only its metronome songs', async () => {
    const { source, opener, gig } = await mixedSetlist();
    const text = await source.backup.exportSetlist(gig.uuid);
    expect(() => parseBackup(text)).not.toThrow();
    expect(parseBackup(text).records.setlists[0]?.presetUuids).toEqual([
      opener.uuid,
    ]);
  });
});
