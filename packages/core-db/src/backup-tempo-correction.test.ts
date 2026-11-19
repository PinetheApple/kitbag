import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ImportMode, Resolution } from './backup-format';
import {
  openBackupDatabase,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import { packFloat32 } from './packing';
import { songs } from './schema';
import { TEMPO_CORRECTION, type TempoCorrection } from './tempo-correction';

const SONG_UUID = 'b51d7e2a-5b6f-4f0e-8a3b-2d9c1e7f6a51';
const FIELD = 'tempoCorrection';
const BACKED_UP = TEMPO_CORRECTION.threeHalves;
const LOCAL = TEMPO_CORRECTION.half;

interface BackupJson {
  librarySongs: Record<string, unknown>[];
}

async function insertSong(
  database: BackupDatabase,
  correction: TempoCorrection | null,
) {
  await database.handle.db.insert(songs).values({
    title: 'Shuffle',
    artist: '',
    filePath: 'songs/s/shuffle.mp3',
    duration: 1,
    format: 'mp3',
    createdAt: SESSION_START,
    uuid: SONG_UUID,
    analysisStatus: 'done',
    beatGrid: packFloat32([0.5, 1, 1.5]),
    tempoCorrection: correction,
  });
}

async function setCorrection(
  database: BackupDatabase,
  correction: TempoCorrection | null,
) {
  await database.handle.db
    .update(songs)
    .set({ tempoCorrection: correction })
    .where(eq(songs.uuid, SONG_UUID));
}

async function stored({ handle }: BackupDatabase) {
  const [row] = await handle.db
    .select({ value: songs.tempoCorrection })
    .from(songs)
    .where(eq(songs.uuid, SONG_UUID));
  return row?.value;
}

type SongJson = Record<string, unknown>;

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

async function backedUpThen(local: TempoCorrection | null) {
  const database = openBackupDatabase();
  await insertSong(database, BACKED_UP);
  const file = await database.backup.export();
  await setCorrection(database, local);
  return { database, file };
}

describe('a song tempo correction in a backup', () => {
  it('round-trips with the song', async () => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP);
    const target = openBackupDatabase();
    await restore(target, await source.backup.export(), 'merge');
    expect(await stored(target)).toBe(BACKED_UP);
  });

  it('exports ×1 as null', async () => {
    const database = openBackupDatabase();
    await insertSong(database, null);
    const root = JSON.parse(await database.backup.export()) as BackupJson;
    expect(root.librarySongs[0]?.[FIELD]).toBeNull();
  });

  it('writes it back under Replace', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, file, 'replace');
    expect(await stored(database)).toBe(BACKED_UP);
  });

  it('holds a correction-only difference as a conflict and takes theirs', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    const plan = unwrap(
      await database.backup.plan(file, { categories: ['librarySongs'] }),
    );
    expect(plan.unresolved).toHaveLength(1);
    await restore(database, file, 'merge', 'theirs');
    expect(await stored(database)).toBe(BACKED_UP);
  });

  it('keeps the device correction when the backup predates the field', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, withoutField(file), 'replace');
    expect(await stored(database)).toBe(LOCAL);
  });

  it('stores a backed-up "none" as NULL', async () => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP);
    const file = editedSong(await source.backup.export(), (song) => ({
      ...song,
      [FIELD]: TEMPO_CORRECTION.none,
    }));
    const target = openBackupDatabase();
    await restore(target, file, 'merge');
    expect(await stored(target)).toBeNull();
  });

  it.each(['"triple"', '2', 'true'])('refuses %s', async (value) => {
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
