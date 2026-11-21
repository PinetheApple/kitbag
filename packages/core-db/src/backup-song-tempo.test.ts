import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ImportMode } from './backup-format';
import {
  openBackupDatabase,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import { packFloat32 } from './packing';
import { songs } from './schema';
import { TEMPO_MODE, TEMPO_SOURCE } from './tempo-mode';

const SONG_UUID = '5e0c2b1a-9d3f-4c7e-8b6a-1f2e3d4c5b6a';
const TEMPO_FIELDS = [
  'tempoMode',
  'tempoBpm',
  'tempoAnchor',
  'tempoBeatsPerBar',
  'tempoSource',
  'chosenTempoMode',
];

const FITTED = {
  tempoMode: TEMPO_MODE.follow,
  tempoBpm: 121.5,
  tempoAnchor: 0.25,
  tempoBeatsPerBar: 4,
  tempoSource: TEMPO_SOURCE.analysed,
  chosenTempoMode: TEMPO_MODE.constant,
};

const REFITTED = { ...FITTED, tempoBpm: 122, chosenTempoMode: null };

async function insertSong(database: BackupDatabase) {
  await database.handle.db.insert(songs).values({
    title: 'Drift',
    artist: '',
    filePath: 'songs/d/drift.mp3',
    duration: 1,
    format: 'mp3',
    createdAt: SESSION_START,
    uuid: SONG_UUID,
    analysisStatus: 'done',
    beatGrid: packFloat32([0.25, 0.75]),
    analysisVersion: 1,
    ...FITTED,
  });
}

async function stored({ handle }: BackupDatabase) {
  const [row] = await handle.db
    .select({
      tempoMode: songs.tempoMode,
      tempoBpm: songs.tempoBpm,
      tempoAnchor: songs.tempoAnchor,
      tempoBeatsPerBar: songs.tempoBeatsPerBar,
      tempoSource: songs.tempoSource,
      chosenTempoMode: songs.chosenTempoMode,
    })
    .from(songs)
    .where(eq(songs.uuid, SONG_UUID));
  return row;
}

async function setTempo(
  { handle }: BackupDatabase,
  change: Partial<typeof FITTED>,
) {
  await handle.db.update(songs).set(change).where(eq(songs.uuid, SONG_UUID));
}

function withoutTempoFields(file: string) {
  const root = JSON.parse(file) as { librarySongs: Record<string, unknown>[] };
  root.librarySongs = root.librarySongs.map((song) =>
    Object.fromEntries(
      Object.entries(song).filter(([field]) => !TEMPO_FIELDS.includes(field)),
    ),
  );
  return JSON.stringify(root);
}

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
    {
      confirmReplace: mode === 'replace',
    },
  );
  expect(applied.ok).toBe(true);
}

describe('a song tempo fit in a backup', () => {
  it('round-trips the fit and the chosen mode', async () => {
    const source = openBackupDatabase();
    await insertSong(source);
    const target = openBackupDatabase();
    await restore(target, await source.backup.export(), 'merge');
    expect(await stored(target)).toEqual(FITTED);
  });

  it('holds a fit-only difference as no conflict, keeping the device fit', async () => {
    const database = openBackupDatabase();
    await insertSong(database);
    const file = await database.backup.export();
    await setTempo(database, { tempoBpm: REFITTED.tempoBpm });
    const merge = await plan(database, file, 'merge');
    expect(merge.counts.librarySongs?.unchanged).toBe(1);
    await database.backup.apply(merge);
    expect(await stored(database)).toEqual({
      ...FITTED,
      tempoBpm: REFITTED.tempoBpm,
    });
  });

  it('leaves a pre-fit file unchanged on Merge; Replace keeps the chosen mode and drops the fit', async () => {
    const database = openBackupDatabase();
    await insertSong(database);
    const file = withoutTempoFields(await database.backup.export());
    const merge = await plan(database, file, 'merge');
    expect(merge.counts.librarySongs?.unchanged).toBe(1);
    await restore(database, file, 'replace');
    expect(await stored(database)).toEqual({
      ...FITTED,
      tempoMode: null,
      tempoBpm: null,
      tempoAnchor: null,
      tempoBeatsPerBar: null,
      tempoSource: null,
    });
  });

  it.each([
    ['tempoMode', '"steady"'],
    ['tempoBpm', '900'],
    ['tempoSource', '"guessed"'],
    ['chosenTempoMode', '"steady"'],
  ] as const)('refuses %s %s', async (field, value) => {
    const source = openBackupDatabase();
    await insertSong(source);
    const file = (await source.backup.export()).replace(
      new RegExp(`"${field}":[^,}]+`),
      `"${field}":${value}`,
    );
    const refused = await openBackupDatabase().backup.plan(file, {
      categories: ['librarySongs'],
    });
    expect(refused).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: `$.librarySongs[0].${field}` },
    });
  });
});
