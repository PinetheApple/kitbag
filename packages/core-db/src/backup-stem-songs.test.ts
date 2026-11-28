import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { unwrap } from './backup.test-helper';
import {
  editedBackup,
  editedTarget,
  expectEdited,
  expectUntouched,
  FOLDER_KEY,
  freshTarget,
  planFor,
  restore,
  STEMDECK_KEY,
  THEIRS,
} from './backup-stem-songs-restore.test-helper';
import {
  addFolderSong,
  addStemDeckSong,
  bundle,
  EDITED,
  expectedEdits,
  FOLDER_UUID,
  JOB,
  LOCAL_SPEED,
  stemSetCount,
  stemSongDatabase,
  THREE_LINES,
} from './backup-stem-songs.test-helper';

const OTHER_JOB = 'job-other';
const E2E_BACKUP = new URL(
  '../../../e2e/fixtures/e2estemsongs.json',
  import.meta.url,
);

describe('stem song settings in a backup', () => {
  it('export carries settings for every stem song, keyed by job or folder UUID', async () => {
    const file = await editedBackup();
    expect(file.categories).toContain('stemSongs');
    expect(file.stemSongs).toEqual([
      expect.objectContaining({
        source: 'stemdeck',
        stemdeckJobId: JOB,
        uuid: null,
        label: EDITED.title,
        ...expectedEdits,
      }),
      expect.objectContaining({
        source: 'folder',
        stemdeckJobId: null,
        uuid: FOLDER_UUID,
      }),
    ]);
    const exported = JSON.stringify(file.stemSongs);
    expect(exported).not.toMatch(/\.flac|beatGrid|"lyrics"|"tempo"/);
  });

  it('a fresh phone takes the folder song at once and asks about the StemDeck mix', async () => {
    const file = await editedBackup();
    const { target, stemdeck, folder } = await freshTarget();
    const plan = await planFor(target, file);
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1 });
    expect(plan.unresolved).toEqual([
      { category: 'stemSongs', key: STEMDECK_KEY, label: EDITED.title },
    ]);
    expect((await restore(target, file, { resolutions: THEIRS })).ok).toBe(
      true,
    );
    await expectEdited(target, stemdeck);
    await expectEdited(target, folder);
  });

  it('importing twice adds no stem song and finds nothing left to change', async () => {
    const file = await editedBackup();
    const { target } = await freshTarget();
    await restore(target, file, { resolutions: THEIRS });
    const again = await planFor(target, file);
    expect(again.counts.stemSongs).toMatchObject({
      unchanged: 2,
      new: 0,
      conflicts: [],
      notOnDevice: 0,
    });
    expect((await target.backup.apply(again)).ok).toBe(true);
    expect(await stemSetCount(target)).toBe(2);
  });

  it('merge lists a stem song changed on both sides for review and writes nothing unresolved', async () => {
    const file = await editedBackup();
    const { target, folder } = await editedTarget();
    const plan = await planFor(target, file);
    expect(plan.unresolved).toContainEqual({
      category: 'stemSongs',
      key: FOLDER_KEY,
      label: EDITED.title,
    });
    expect((await target.backup.apply(plan)).ok).toBe(false);
    await expectUntouched(target, folder, LOCAL_SPEED);
  });

  it('merge resolved as mine keeps the device settings', async () => {
    const file = await editedBackup();
    const { target, stemdeck } = await editedTarget();
    const mine = { [STEMDECK_KEY]: 'mine', [FOLDER_KEY]: 'mine' } as const;
    const result = await restore(target, file, {
      resolutions: { stemSongs: mine },
    });
    expect(result.ok).toBe(true);
    await expectUntouched(target, stemdeck, LOCAL_SPEED);
  });

  it('merge resolved as theirs takes the backup over a local change', async () => {
    const file = await editedBackup();
    const { target, stemdeck, folder } = await editedTarget();
    expect((await restore(target, file, { resolutions: THEIRS })).ok).toBe(
      true,
    );
    await expectEdited(target, stemdeck);
    await expectEdited(target, folder);
  });

  it('replace overwrites the matched stem songs and deletes none', async () => {
    const file = await editedBackup();
    const { target, stemdeck, folder } = await freshTarget();
    const spare = await addStemDeckSong(target, OTHER_JOB);
    const plan = await planFor(target, file, {
      mode: 'replace',
      categories: ['stemSongs'],
    });
    expect(plan.counts.stemSongs).toMatchObject({ updates: 2, deletes: 0 });
    expect((await target.backup.apply(plan, { confirmReplace: true })).ok).toBe(
      true,
    );
    await expectEdited(target, stemdeck);
    await expectEdited(target, folder);
    await expectUntouched(target, spare);
  });

  it('skips and counts a stem song that is not on this device', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const other = await addStemDeckSong(target, OTHER_JOB);
    const plan = await planFor(target, file);
    expect(plan.counts.stemSongs).toMatchObject({
      incoming: 2,
      new: 0,
      notOnDevice: 2,
      conflicts: [],
    });
    const report = unwrap(await target.backup.apply(plan));
    expect(report.counts.stemSongs?.notOnDevice).toBe(2);
    expect(await stemSetCount(target)).toBe(1);
    await expectUntouched(target, other);
  });

  it('matches a re-imported StemDeck song by its job', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await target.library.insertStemBundle(bundle(JOB));
    const plan = await planFor(target, file, { resolutions: THEIRS });
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1, notOnDevice: 1 });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await expectEdited(target, id);
  });

  it('matches a folder stem song by its UUID and not by a StemDeck job', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await addFolderSong(target);
    const plan = await planFor(target, file);
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1, notOnDevice: 1 });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await expectEdited(target, id);
  });

  it('keeps the device line times when the backup retimed different lyrics', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await target.library.insertStemBundle({
      ...bundle(JOB),
      lyrics: THREE_LINES,
    });
    const plan = await planFor(target, file, { resolutions: THEIRS });
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1 });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    expect(await target.library.readStemSet(id)).toMatchObject({
      ...expectedEdits,
      lyricsRetimed: null,
    });
  });

  it.each(['merge', 'replace'] as const)(
    '%s of an older backup without stem songs leaves them untouched',
    async (mode) => {
      const file = await editedBackup();
      file.categories = file.categories.filter((c) => c !== 'stemSongs');
      delete file.stemSongs;
      const { target, stemdeck } = await freshTarget();
      const plan = await planFor(target, file, { mode });
      expect(plan.categories).not.toContain('stemSongs');
      expect(
        (await target.backup.apply(plan, { confirmReplace: true })).ok,
      ).toBe(true);
      await expectUntouched(target, stemdeck);
    },
  );

  it.each([
    ['a StemDeck song without a job', { stemdeckJobId: null }, 'stemdeckJobId'],
    ['a StemDeck song with a UUID', { uuid: FOLDER_UUID }, 'uuid'],
    ['an unknown click rate', { clickRate: 'triple' }, 'clickRate'],
    ['a speed of zero', { speed: 0 }, 'speed'],
  ])('refuses %s', async (_, change, field) => {
    const file = await editedBackup();
    const [first] = file.stemSongs ?? [];
    file.stemSongs = [{ ...first, ...change }];
    const plan = await stemSongDatabase().backup.plan(JSON.stringify(file));
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: `$.stemSongs[0].${field}` },
    });
  });

  it('reads the device flow fixture as one stem song not on this device', async () => {
    const plan = unwrap(
      await stemSongDatabase().backup.plan(readFileSync(E2E_BACKUP, 'utf8')),
    );
    expect(plan.categories).toEqual(['stemSongs']);
    expect(plan.counts.stemSongs).toMatchObject({
      incoming: 1,
      notOnDevice: 1,
    });
  });
});
