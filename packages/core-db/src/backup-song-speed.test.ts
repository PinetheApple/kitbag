import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ImportMode, Resolution } from './backup-format';
import {
  openBackupDatabase,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import { songs } from './schema';

const SONG_UUID = 'c62e8f3b-6c7a-4a1f-9b4c-3e0d2f8a7b62';
const FIELD = 'speed';
const BACKED_UP = 0.75;
const LOCAL = 0.9;

interface BackupJson {
  librarySongs: Record<string, unknown>[];
}

type SongJson = Record<string, unknown>;

async function insertSong(database: BackupDatabase, speed: number) {
  await database.handle.db.insert(songs).values({
    title: 'Everlong',
    artist: '',
    filePath: 'songs/e/everlong.mp3',
    duration: 1,
    format: 'mp3',
    createdAt: SESSION_START,
    uuid: SONG_UUID,
    speed,
  });
}

async function setSpeed(database: BackupDatabase, speed: number) {
  await database.handle.db
    .update(songs)
    .set({ speed })
    .where(eq(songs.uuid, SONG_UUID));
}

async function stored({ handle }: BackupDatabase) {
  const [row] = await handle.db
    .select({ value: songs.speed })
    .from(songs)
    .where(eq(songs.uuid, SONG_UUID));
  return row?.value;
}

function editedSong(file: string, edit: (song: SongJson) => SongJson) {
  const root = JSON.parse(file) as BackupJson;
  root.librarySongs = root.librarySongs.map(edit);
  return JSON.stringify(root);
}

const withoutField = (file: string) =>
  editedSong(file, (song) =>
    Object.fromEntries(Object.entries(song).filter(([key]) => key !== FIELD)),
  );

async function restore(
  database: BackupDatabase,
  file: string,
  mode: ImportMode,
  resolution?: Resolution,
) {
  const plan = unwrap(
    await database.backup.plan(file, {
      mode,
      categories: ['librarySongs'],
      ...(resolution && {
        resolutions: { librarySongs: { [SONG_UUID]: resolution } },
      }),
    }),
  );
  const applied = await database.backup.apply(plan, {
    confirmReplace: mode === 'replace',
  });
  expect(applied.ok).toBe(true);
}

async function backedUpThen(local: number) {
  const database = openBackupDatabase();
  await insertSong(database, BACKED_UP);
  const file = await database.backup.export();
  await setSpeed(database, local);
  return { database, file };
}

describe('a song speed in a backup', () => {
  it('round-trips with the song', async () => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP);
    const target = openBackupDatabase();
    await restore(target, await source.backup.export(), 'merge');
    expect(await stored(target)).toBe(BACKED_UP);
  });

  it('writes it back under Replace', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, file, 'replace');
    expect(await stored(database)).toBe(BACKED_UP);
  });

  it('holds a speed-only difference as a conflict and takes theirs', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    const plan = unwrap(
      await database.backup.plan(file, { categories: ['librarySongs'] }),
    );
    expect(plan.unresolved).toHaveLength(1);
    await restore(database, file, 'merge', 'theirs');
    expect(await stored(database)).toBe(BACKED_UP);
  });

  it('keeps the device speed when the backup predates the field', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, withoutField(file), 'replace');
    expect(await stored(database)).toBe(LOCAL);
  });

  it('restores a song from a backup without the field at full speed', async () => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP);
    const target = openBackupDatabase();
    await restore(target, withoutField(await source.backup.export()), 'merge');
    expect(await stored(target)).toBe(1);
  });

  it.each(['0', '-0.5', 'null', '"slow"'])('refuses %s', async (value) => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP);
    const file = (await source.backup.export()).replace(
      new RegExp(`"${FIELD}":[^,}]+`),
      `"${FIELD}":${value}`,
    );
    const plan = await openBackupDatabase().backup.plan(file, {
      categories: ['librarySongs'],
    });
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: `$.librarySongs[0].${FIELD}` },
    });
  });
});
