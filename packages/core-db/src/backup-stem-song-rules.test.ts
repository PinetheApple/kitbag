import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import type { Resolutions } from './backup-format';
import {
  editedBackup,
  expectEdited,
  planFor,
  restore,
  STEMDECK_KEY,
  THEIRS,
  type ExportedFile,
} from './backup-stem-songs-restore.test-helper';
import {
  addFolderSong,
  addStemDeckSong,
  bundle,
  edit,
  EDITED,
  JOB,
  LOCAL_SPEED,
  mixOf,
  ROLES,
  setSpeed,
  stemSongDatabase,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';

const LOCAL_TITLE = 'Echo (my take)';
const EXTRA_ROLE = 'bass';
const UNITY_MIX = { volume: 1, muted: false, soloed: false };

async function speedOnlyBackup(): Promise<ExportedFile> {
  const source = stemSongDatabase();
  await setSpeed(source, await addFolderSong(source), EDITED.speed);
  return JSON.parse(await source.backup.export()) as ExportedFile;
}

async function backupWithRoles(roles: string[]): Promise<ExportedFile> {
  const source = stemSongDatabase();
  await edit(source, await addFolderSong(source, roles));
  return JSON.parse(await source.backup.export()) as ExportedFile;
}

async function expectSettled(target: StemSongDatabase, file: ExportedFile) {
  const again = await planFor(target, file);
  expect(again.counts.stemSongs).toMatchObject({
    unchanged: 1,
    updates: 0,
    conflicts: [],
  });
}

describe('a backup with no rename has no opinion on the name', () => {
  it('replace keeps a local rename and settles', async () => {
    const file = await speedOnlyBackup();
    const target = stemSongDatabase();
    const id = await addFolderSong(target);
    await target.library.renameStemSet(id, LOCAL_TITLE);
    const options = { mode: 'replace', categories: ['stemSongs'] } as const;
    expect((await restore(target, file, options)).ok).toBe(true);
    expect(await target.library.readStemSet(id)).toMatchObject({
      title: LOCAL_TITLE,
      speed: EDITED.speed,
    });
    await expectSettled(target, file);
  });

  it('merge resolved as theirs keeps a local rename and settles', async () => {
    const file = await speedOnlyBackup();
    const target = stemSongDatabase();
    const id = await addFolderSong(target);
    await target.library.renameStemSet(id, LOCAL_TITLE);
    await setSpeed(target, id, LOCAL_SPEED);
    const [conflict] = (await planFor(target, file)).unresolved;
    expect(conflict).toBeDefined();
    const resolutions: Resolutions = {
      stemSongs: { [conflict?.key ?? '']: 'theirs' },
    };
    expect((await restore(target, file, { resolutions })).ok).toBe(true);
    expect(await target.library.readStemSet(id)).toMatchObject({
      title: LOCAL_TITLE,
      speed: EDITED.speed,
    });
    await expectSettled(target, file);
  });
});

describe('which differences need review', () => {
  it('takes the backup when every differing field is at its import value here', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await addFolderSong(target);
    await setSpeed(target, id, EDITED.speed);
    const plan = await planFor(target, file);
    expect(plan.counts.stemSongs).toMatchObject({ updates: 1, conflicts: [] });
    expect((await target.backup.apply(plan)).ok).toBe(true);
    await expectEdited(target, id);
  });

  it('asks before a backup mix replaces a StemDeck mix, even one back at unity', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await addStemDeckSong(target);
    const vocals = (await target.library.readStemSet(id))?.stems[0];
    if (vocals === undefined) throw new Error('setup');
    await target.library.saveStemMix([{ ...vocals, muted: true }]);
    await target.library.saveStemMix([{ ...vocals, muted: false }]);
    const plan = await planFor(target, file);
    expect(plan.unresolved.map(({ key }) => key)).toEqual([STEMDECK_KEY]);
    expect((await target.backup.apply(plan)).ok).toBe(false);
    const mixes = mixOf(await target.library.readStemSet(id));
    expect(
      mixes?.map(({ volume, muted, soloed }) => ({ volume, muted, soloed })),
    ).toEqual(ROLES.map(() => UNITY_MIX));
  });
});

describe('restoring onto what the phone can play', () => {
  it('drops a tempo mode the phone cannot build and settles', async () => {
    const file = await editedBackup();
    const target = stemSongDatabase();
    const id = await target.library.insertStemBundle({
      ...bundle(JOB),
      tempo: null,
    });
    expect((await restore(target, file, { resolutions: THEIRS })).ok).toBe(
      true,
    );
    expect(await target.library.readStemSet(id)).toMatchObject({
      chosenTempoMode: null,
      speed: EDITED.speed,
    });
    await expectSettled(target, file);
  });

  it.each([
    ['a role the phone lacks', [...ROLES, EXTRA_ROLE], ROLES],
    ['a role the backup lacks', ROLES, [...ROLES, EXTRA_ROLE]],
    ['a role twice on the phone', ROLES, [...ROLES, 'drums']],
  ])('restores past %s and settles', async (_, backupRoles, phoneRoles) => {
    const file = await backupWithRoles(backupRoles);
    const target = stemSongDatabase();
    const id = await addFolderSong(target, phoneRoles);
    expect((await restore(target, file)).ok).toBe(true);
    const drums = (await target.library.readStemSet(id))?.stems.filter(
      ({ role }) => role === 'drums',
    );
    expect(drums?.map(({ volume }) => volume)).toEqual(
      drums?.map(() => EDITED.drums.gain),
    );
    await expectSettled(target, file);
  });
});
