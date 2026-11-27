import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import type { ImportMode } from './backup-format';
import {
  openBackupDatabase,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import {
  addStemDeckSong,
  stemSongDatabase,
  type StemSongDatabase,
} from './backup-stem-songs.test-helper';
import { GRID_METER, NO_METER_OVERRIDE } from './meter-override';
import { packFloat32 } from './packing';
import { songs } from './schema';
import { createSongLibraryRepository } from './song-library-repository';

const SONG_UUID = '0b5f7c2e-3a1d-4e6f-9b8a-7c6d5e4f3a2b';
const MANUAL = { bpm: 127.6, anchor: 2.3, beatsPerBar: GRID_METER.triple };
const CHANGED = { ...MANUAL, bpm: 66 };
const MANUAL_FIELDS = [
  'manualTempoBpm',
  'manualTempoAnchor',
  'manualTempoBeatsPerBar',
];

async function insertSong(database: BackupDatabase) {
  const [row] = await database.handle.db
    .insert(songs)
    .values({
      title: 'Rubato',
      artist: '',
      filePath: 'songs/r/rubato.flac',
      duration: 300,
      format: 'flac',
      createdAt: SESSION_START,
      uuid: SONG_UUID,
      analysisStatus: 'done',
      beatGrid: packFloat32([0.5, 1]),
    })
    .returning({ id: songs.id });
  if (row === undefined) throw new Error('song insert');
  return row.id;
}

async function songWithManualTempo(manualTempo = MANUAL) {
  const database = openBackupDatabase();
  const id = await insertSong(database);
  await createSongLibraryRepository(database.handle).saveSongManualTempo(id, {
    manualTempo,
    meterOverride: NO_METER_OVERRIDE,
  });
  return { database, id };
}

const storedManual = async ({ handle }: BackupDatabase) =>
  (
    await createSongLibraryRepository(handle).readSong(
      (
        await handle.db
          .select({ id: songs.id })
          .from(songs)
          .where(eq(songs.uuid, SONG_UUID))
      )[0]?.id ?? Number.NaN,
    )
  )?.manualTempo;

function editSongs(
  file: string,
  change: (song: Record<string, unknown>) => Record<string, unknown>,
) {
  const root = JSON.parse(file) as { librarySongs: Record<string, unknown>[] };
  root.librarySongs = root.librarySongs.map(change);
  return JSON.stringify(root);
}

const withoutManualFields = (song: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(song).filter(([field]) => !MANUAL_FIELDS.includes(field)),
  );

const plan = async (database: BackupDatabase, file: string, mode: ImportMode) =>
  unwrap(
    await database.backup.plan(file, { mode, categories: ['librarySongs'] }),
  );

async function restore(
  database: BackupDatabase,
  file: string,
  mode: ImportMode,
) {
  const applied = await database.backup.apply(
    await plan(database, file, mode),
    { confirmReplace: mode === 'replace' },
  );
  expect(applied.ok).toBe(true);
}

describe('a song manual tempo in a backup', () => {
  it('round-trips to another phone', async () => {
    const { database } = await songWithManualTempo();
    const target = openBackupDatabase();
    await restore(target, await database.backup.export(), 'merge');
    expect(await storedManual(target)).toEqual(MANUAL);
  });

  it('is a conflict on Merge when it differs', async () => {
    const { database } = await songWithManualTempo();
    const file = await database.backup.export();
    const { database: changed } = await songWithManualTempo(CHANGED);
    const merge = await plan(changed, file, 'merge');
    expect(merge.counts.librarySongs?.conflicts).toHaveLength(1);
  });

  it.each(['merge', 'replace'] as const)(
    'keeps the phone value on %s from a file without the fields',
    async (mode) => {
      const { database } = await songWithManualTempo();
      const file = editSongs(
        await database.backup.export(),
        withoutManualFields,
      );
      if (mode === 'merge')
        expect(
          (await plan(database, file, mode)).counts.librarySongs?.unchanged,
        ).toBe(1);
      await restore(database, file, mode);
      expect(await storedManual(database)).toEqual(MANUAL);
    },
  );

  it.each([
    ['manualTempoBpm', { manualTempoBpm: 900 }],
    ['manualTempoAnchor', { manualTempoAnchor: null }],
    ['manualTempoBeatsPerBar', { manualTempoBeatsPerBar: 5 }],
  ])('refuses a file with a bad %s', async (field, change) => {
    const { database } = await songWithManualTempo();
    const file = editSongs(await database.backup.export(), (song) => ({
      ...song,
      ...change,
    }));
    const refused = await openBackupDatabase().backup.plan(file, {
      categories: ['librarySongs'],
    });
    expect(refused).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: `$.librarySongs[0].${field}` },
    });
  });
});

async function stemSongWithManualTempo() {
  const database = stemSongDatabase();
  const id = await addStemDeckSong(database);
  await database.library.saveStemSetManualTempo(id, {
    manualTempo: MANUAL,
    meterOverride: NO_METER_OVERRIDE,
  });
  return { database, id };
}

const stemManual = async ({ library }: StemSongDatabase, id: number) =>
  (await library.readStemSet(id))?.manualTempo;

function editStemSongs(
  file: string,
  change: (song: Record<string, unknown>) => Record<string, unknown>,
) {
  const root = JSON.parse(file) as { stemSongs: Record<string, unknown>[] };
  root.stemSongs = root.stemSongs.map(change);
  return JSON.stringify(root);
}

async function restoreStemSongs(target: StemSongDatabase, file: string) {
  const planned = unwrap(
    await target.backup.plan(file, { categories: ['stemSongs'] }),
  );
  expect((await target.backup.apply(planned)).ok).toBe(true);
}

describe('a stem song manual tempo in a backup', () => {
  it('restores onto the same StemDeck song on another phone', async () => {
    const { database } = await stemSongWithManualTempo();
    const target = stemSongDatabase();
    const id = await addStemDeckSong(target);
    await restoreStemSongs(target, await database.backup.export());
    expect(await stemManual(target, id)).toEqual(MANUAL);
  });

  it('keeps the phone value from a file without the fields', async () => {
    const { database, id } = await stemSongWithManualTempo();
    const file = editStemSongs(
      await database.backup.export(),
      withoutManualFields,
    );
    await restoreStemSongs(database, file);
    expect(await stemManual(database, id)).toEqual(MANUAL);
  });

  it('refuses a file with a partial manual tempo', async () => {
    const { database } = await stemSongWithManualTempo();
    const file = editStemSongs(await database.backup.export(), (song) => ({
      ...song,
      manualTempoAnchor: null,
    }));
    const refused = await stemSongDatabase().backup.plan(file, {
      categories: ['stemSongs'],
    });
    expect(refused).toMatchObject({
      ok: false,
      error: {
        kind: 'invalidField',
        path: '$.stemSongs[0].manualTempoAnchor',
      },
    });
  });
});
