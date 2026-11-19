import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { unwrap } from './backup.test-helper';
import type { ImportOptions } from './backup-plan';
import {
  addFolderSong,
  addStemDeckSong,
  bundle,
  edit,
  EDITED,
  EDITED_MIX,
  expectedEdits,
  FOLDER_UUID,
  JOB,
  LOCAL_SPEED,
  mixOf,
  setSpeed,
  stemSetCount,
  stemSongDatabase,
  THREE_LINES,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';
import { CLICK_RATE } from './click-rate';

const STEMDECK_KEY = `stemdeck:${JOB}`;
const FOLDER_KEY = `folder:${FOLDER_UUID}`;
const OTHER_JOB = 'job-other';
const E2E_BACKUP = new URL(
  '../../../e2e/fixtures/e2estemsongs.json',
  import.meta.url,
);

interface ExportedFile {
  categories: string[];
  stemSongs?: Record<string, unknown>[];
}

async function editedBackup() {
  const source = stemSongDatabase();
  await edit(source, await addStemDeckSong(source));
  await edit(source, await addFolderSong(source));
  return JSON.parse(await source.backup.export()) as ExportedFile;
}

async function freshTarget() {
  const target = stemSongDatabase();
  const stemdeck = await addStemDeckSong(target);
  const folder = await addFolderSong(target);
  return { target, stemdeck, folder };
}

async function editedTarget() {
  const fresh = await freshTarget();
  await setSpeed(fresh.target, fresh.stemdeck, LOCAL_SPEED);
  await setSpeed(fresh.target, fresh.folder, LOCAL_SPEED);
  return fresh;
}

async function restore(
  target: StemSongDatabase,
  file: ExportedFile,
  options: ImportOptions = {},
) {
  const plan = unwrap(await target.backup.plan(JSON.stringify(file), options));
  return target.backup.apply(plan, { confirmReplace: true });
}

const THEIRS = {
  stemSongs: { [STEMDECK_KEY]: 'theirs', [FOLDER_KEY]: 'theirs' },
} as const;

async function expectEdited(target: StemSongDatabase, id: number) {
  const set = await target.library.readStemSet(id);
  expect(set).toMatchObject(expectedEdits);
  expect(mixOf(set)).toEqual(EDITED_MIX);
}

async function expectUntouched(
  target: StemSongDatabase,
  id: number,
  speed = 1,
) {
  const set = await target.library.readStemSet(id);
  expect(set).toMatchObject({
    title: 'Echo',
    speed,
    meterBeatsPerBar: null,
    lyricsRetimed: null,
    clickRate: CLICK_RATE.single,
    chosenTempoMode: null,
  });
  expect(mixOf(set)?.map(({ volume }) => volume)).toEqual([1, 1]);
}

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
    expect(JSON.stringify(file.stemSongs)).not.toMatch(/\.flac|beatGrid/);
  });

  it('merge onto stem songs still at their import defaults restores without review', async () => {
    const file = await editedBackup();
    const { target, stemdeck, folder } = await freshTarget();
    const plan = unwrap(await target.backup.plan(JSON.stringify(file)));
    expect(plan.counts.stemSongs).toMatchObject({ updates: 2, conflicts: [] });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await expectEdited(target, stemdeck);
    await expectEdited(target, folder);
  });

  it('importing twice adds no stem song and finds nothing left to change', async () => {
    const file = await editedBackup();
    const { target } = await freshTarget();
    await restore(target, file);
    const again = unwrap(await target.backup.plan(JSON.stringify(file)));
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
    const { target, stemdeck } = await editedTarget();
    const plan = unwrap(await target.backup.plan(JSON.stringify(file)));
    expect(plan.unresolved).toContainEqual({
      category: 'stemSongs',
      key: STEMDECK_KEY,
      label: EDITED.title,
    });
    expect((await target.backup.apply(plan)).ok).toBe(false);
    await expectUntouched(target, stemdeck, LOCAL_SPEED);
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

  it('keeps the device line times when the backup retimed different lyrics', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await target.library.insertStemBundle({
      ...bundle(JOB),
      lyrics: THREE_LINES,
    });
    const plan = unwrap(await target.backup.plan(JSON.stringify(file)));
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1, conflicts: [] });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    expect(await target.library.readStemSet(id)).toMatchObject({
      ...expectedEdits,
      lyricsRetimed: null,
    });
  });

  it('replace overwrites the matched stem songs and deletes none', async () => {
    const file = await editedBackup();
    const { target, stemdeck, folder } = await freshTarget();
    const spare = await addStemDeckSong(target, OTHER_JOB);
    const plan = unwrap(
      await target.backup.plan(JSON.stringify(file), {
        mode: 'replace',
        categories: ['stemSongs'],
      }),
    );
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
    const plan = unwrap(await target.backup.plan(JSON.stringify(file)));
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

  it('matches a re-imported StemDeck song by its job, whatever its UUID', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await target.library.insertStemBundle(bundle(JOB));
    const plan = unwrap(await target.backup.plan(JSON.stringify(file)));
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1, notOnDevice: 1 });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await expectEdited(target, id);
  });

  it('matches a folder stem song by its UUID and not by a StemDeck job', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await addFolderSong(target);
    const plan = unwrap(await target.backup.plan(JSON.stringify(file)));
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1, notOnDevice: 1 });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await expectEdited(target, id);
  });

  it.each(['merge', 'replace'] as const)(
    '%s of an older backup without stem songs leaves them untouched',
    async (mode) => {
      const file = await editedBackup();
      file.categories = file.categories.filter((c) => c !== 'stemSongs');
      delete file.stemSongs;
      const { target, stemdeck } = await freshTarget();
      const plan = unwrap(
        await target.backup.plan(JSON.stringify(file), { mode }),
      );
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
