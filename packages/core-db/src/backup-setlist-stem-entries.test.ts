import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { asc, eq } from 'drizzle-orm';

import type { ImportOptions } from './backup-plan';
import { parseBackup } from './backup-parse';
import { FOLDER_KEY } from './backup-stem-songs-restore.test-helper';
import {
  addFolderSong,
  addStemDeckSong,
  stemSongDatabase,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';
import { presetValues, unwrap } from './backup.test-helper';
import { found } from './repository';
import { setlistItems, setlists, songPresets, stemSets } from './schema';
import { STEM_SET_SOURCE } from './stem-set-source';

const ECHO_JOB = 'job-echo-live';
const ECHO_KEY = `stemdeck:${ECHO_JOB}`;

async function addAnonymousStemSet({ handle }: StemSongDatabase) {
  return found(
    await handle.db
      .insert(stemSets)
      .values({
        name: 'No job',
        createdAt: new Date(0),
        uuid: crypto.randomUUID(),
        source: STEM_SET_SOURCE.stemdeck,
      })
      .returning({ id: stemSets.id }),
    'Stem set insert',
  ).id;
}

async function mixedSource() {
  const source = stemSongDatabase();
  const opener = await source.presets.create(presetValues('Opener', null));
  const closer = await source.presets.create(presetValues('Closer', null));
  const echo = await addStemDeckSong(source, ECHO_JOB);
  const folder = await addFolderSong(source);
  const anonymous = await addAnonymousStemSet(source);
  const gig = await source.sets.create('Gig');
  await source.sets.add(gig.id, opener.id);
  await source.sets.addStemSet(gig.id, echo);
  await source.sets.add(gig.id, closer.id);
  await source.sets.addStemSet(gig.id, folder);
  await source.sets.addStemSet(gig.id, anonymous);
  const items = [
    { preset: opener.uuid },
    { stemSong: ECHO_KEY },
    { preset: closer.uuid },
    { stemSong: FOLDER_KEY },
  ];
  return { source, opener, closer, gig, items };
}

async function targetWithSongs() {
  const target = stemSongDatabase();
  const echo = await addStemDeckSong(target, ECHO_JOB);
  const folder = await addFolderSong(target);
  return { target, echo, folder };
}

type Entry = { preset: string } | { stemSet: number };

async function entriesOf({ handle }: StemSongDatabase, setlistUuid: string) {
  const rows = await handle.db
    .select({
      preset: songPresets.uuid,
      stemSet: setlistItems.stemSetId,
    })
    .from(setlistItems)
    .innerJoin(setlists, eq(setlists.id, setlistItems.setlistId))
    .leftJoin(songPresets, eq(songPresets.id, setlistItems.songPresetId))
    .where(eq(setlists.uuid, setlistUuid))
    .orderBy(asc(setlistItems.position), asc(setlistItems.id));
  return rows.map(({ preset, stemSet }): Entry =>
    preset === null ? { stemSet: stemSet ?? -1 } : { preset },
  );
}

async function restore(
  target: StemSongDatabase,
  text: string,
  options: ImportOptions = {},
) {
  const plan = unwrap(await target.backup.plan(text, options));
  unwrap(await target.backup.apply(plan, { confirmReplace: true }));
  return plan;
}

function withoutItems(text: string) {
  const file = JSON.parse(text) as { setlists: Record<string, unknown>[] };
  for (const setlist of file.setlists) delete setlist.items;
  return JSON.stringify(file);
}

describe('a setlist holding stem songs in a backup', () => {
  it('writes every entry in order and keeps presetUuids to the metronome songs', async () => {
    const { source, opener, closer, items } = await mixedSource();
    const [setlist] = parseBackup(await source.backup.export()).records
      .setlists;
    expect(setlist?.items).toEqual(items);
    expect(setlist?.presetUuids).toEqual([opener.uuid, closer.uuid]);
  });

  it('restores both kinds of entry in order onto the stem songs on this phone', async () => {
    const { source, opener, closer, gig } = await mixedSource();
    const { target, echo, folder } = await targetWithSongs();
    const plan = await restore(target, await source.backup.export());
    expect(plan.counts.setlists).toMatchObject({
      new: 1,
      stemEntriesNotOnDevice: 0,
    });
    expect(await entriesOf(target, gig.uuid)).toEqual([
      { preset: opener.uuid },
      { stemSet: echo },
      { preset: closer.uuid },
      { stemSet: folder },
    ]);
  });

  it('restores the metronome songs of a file without items as before', async () => {
    const { source, opener, closer, gig } = await mixedSource();
    const { target } = await targetWithSongs();
    const text = withoutItems(await source.backup.export());
    const plan = await restore(target, text);
    expect(plan.counts.setlists).toMatchObject({ new: 1 });
    expect(await entriesOf(target, gig.uuid)).toEqual([
      { preset: opener.uuid },
      { preset: closer.uuid },
    ]);
  });

  it('rejects items whose metronome songs disagree with presetUuids', async () => {
    const { source } = await mixedSource();
    const file = JSON.parse(await source.backup.export()) as {
      setlists: { presetUuids: string[] }[];
    };
    file.setlists[0]?.presetUuids.reverse();
    const result = await source.backup.plan(JSON.stringify(file));
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        kind: 'invalidField',
        path: '$.setlists[0].items',
      }) as unknown,
    });
  });

  it('drops and counts a stem song this phone does not have, and restores the rest', async () => {
    const { source, opener, closer, gig } = await mixedSource();
    const target = stemSongDatabase();
    const folder = await addFolderSong(target);
    const plan = await restore(target, await source.backup.export());
    expect(plan.counts.setlists).toMatchObject({
      new: 1,
      stemEntriesNotOnDevice: 1,
    });
    expect(await entriesOf(target, gig.uuid)).toEqual([
      { preset: opener.uuid },
      { preset: closer.uuid },
      { stemSet: folder },
    ]);
  });

  it('a replace restore writes the stem entries of the file', async () => {
    const { source, opener, closer, gig } = await mixedSource();
    const { target, echo, folder } = await targetWithSongs();
    const text = await source.backup.export();
    await restore(target, text);
    await restore(target, text, { mode: 'replace' });
    expect(await entriesOf(target, gig.uuid)).toEqual([
      { preset: opener.uuid },
      { stemSet: echo },
      { preset: closer.uuid },
      { stemSet: folder },
    ]);
  });

  it('a replace restore from a file without items keeps the stem entries after the metronome songs', async () => {
    const { source, opener, closer, gig } = await mixedSource();
    const { target, echo, folder } = await targetWithSongs();
    const text = await source.backup.export();
    await restore(target, text);
    await restore(target, withoutItems(text), { mode: 'replace' });
    expect(await entriesOf(target, gig.uuid)).toEqual([
      { preset: opener.uuid },
      { preset: closer.uuid },
      { stemSet: echo },
      { stemSet: folder },
    ]);
  });

  it('a merge finds the same setlist unchanged and takes a reordered one as theirs', async () => {
    const { source, opener, closer, gig } = await mixedSource();
    const { target, echo, folder } = await targetWithSongs();
    await restore(target, await source.backup.export());
    const again = unwrap(
      await target.backup.plan(await source.backup.export()),
    );
    expect(again.counts.setlists).toMatchObject({ unchanged: 1, new: 0 });

    const [first] = await source.sets.items(gig.id);
    if (first === undefined) throw new Error('setup');
    await source.sets.move(first.id, 3);
    const reordered = await source.backup.export();
    const conflicted = unwrap(await target.backup.plan(reordered));
    expect(conflicted.unresolved).toEqual([
      expect.objectContaining({ category: 'setlists', key: gig.uuid }),
    ]);
    await restore(target, reordered, {
      resolutions: { setlists: { [gig.uuid]: 'theirs' } },
    });
    expect(await entriesOf(target, gig.uuid)).toEqual([
      { stemSet: echo },
      { preset: closer.uuid },
      { stemSet: folder },
      { preset: opener.uuid },
    ]);
  });

  it('exports on its own with its entries and listed presets, without stem mixes', async () => {
    const { source, opener, closer, gig, items } = await mixedSource();
    const file = parseBackup(await source.backup.exportSetlist(gig.uuid));
    expect(file.categories).toEqual(['songPresets', 'setlists']);
    expect(file.records.setlists[0]?.items).toEqual(items);
    expect(file.records.songPresets.map(({ uuid }) => uuid).sort()).toEqual(
      [opener.uuid, closer.uuid].sort(),
    );
    expect(file.records.stemSongs).toEqual([]);
  });
});
