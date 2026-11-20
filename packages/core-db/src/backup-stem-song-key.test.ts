import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import {
  freshTarget,
  planFor,
  restore,
  FOLDER_KEY,
  type ExportedFile,
} from './backup-stem-songs-restore.test-helper';
import {
  addFolderSong,
  stemSongDatabase,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';

const BACKUP_KEY = 3;
const LOCAL_KEY = -1;
const REPLACE = { mode: 'replace', categories: ['stemSongs'] } as const;

async function setSongKey(
  { library }: StemSongDatabase,
  id: number,
  pitch: number,
) {
  await library.saveStemSetSpeedKey(id, { speed: 1, pitch, stems: [] });
}

async function backupWithKey(pitch: number): Promise<ExportedFile> {
  const source = stemSongDatabase();
  await setSongKey(source, await addFolderSong(source), pitch);
  return JSON.parse(await source.backup.export()) as ExportedFile;
}

async function songKey({ library }: StemSongDatabase, id: number) {
  return (await library.readStemSet(id))?.pitch;
}

function withoutKey(file: ExportedFile): ExportedFile {
  return {
    ...file,
    stemSongs: (file.stemSongs ?? []).map((song) => {
      const copy = { ...song };
      delete copy.pitch;
      return copy;
    }),
  };
}

describe('the song key in a backup', () => {
  it('export carries the song key and a restore puts it back', async () => {
    const file = await backupWithKey(BACKUP_KEY);
    expect(file.stemSongs).toEqual([
      expect.objectContaining({ pitch: BACKUP_KEY }),
    ]);
    const { target, folder } = await freshTarget();
    expect((await restore(target, file)).ok).toBe(true);
    expect(await songKey(target, folder)).toBe(BACKUP_KEY);
  });

  it('reads a backup written before the song key as unshifted', async () => {
    const file = withoutKey(await backupWithKey(BACKUP_KEY));
    const { target, folder } = await freshTarget();
    const plan = await planFor(target, file);
    expect(plan.counts.stemSongs).toMatchObject({ unchanged: 1 });
    await setSongKey(target, folder, LOCAL_KEY);
    expect((await restore(target, file, REPLACE)).ok).toBe(true);
    expect(await songKey(target, folder)).toBe(0);
  });

  it('asks about a song key changed on both sides', async () => {
    const file = await backupWithKey(BACKUP_KEY);
    const { target, folder } = await freshTarget();
    await setSongKey(target, folder, LOCAL_KEY);
    const plan = await planFor(target, file);
    expect(plan.unresolved).toEqual([
      expect.objectContaining({ category: 'stemSongs', key: FOLDER_KEY }),
    ]);
  });

  it.each([
    ['below the key range', -7],
    ['above the key range', 7],
    ['between semitones', 1.5],
    ['not a number', '2'],
  ])('refuses a song key %s', async (_, pitch) => {
    const file = await backupWithKey(0);
    const [first] = file.stemSongs ?? [];
    file.stemSongs = [{ ...first, pitch }];
    const plan = await stemSongDatabase().backup.plan(JSON.stringify(file));
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: '$.stemSongs[0].pitch' },
    });
  });
});
