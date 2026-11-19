import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ImportMode, Resolution } from './backup-format';
import {
  openBackupDatabase,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import { GRID_METER, type GridMeter } from './meter-override';
import { packFloat32 } from './packing';
import { songs } from './schema';
import { createSongLibraryRepository } from './song-library-repository';

const SONG_UUID = 'c41d7e2a-5b6f-4f0e-8a3b-2d9c1e7f6a50';
const SONG_TITLE = 'Waltz';
const UNSUPPORTED_METER = 5;
const SONG_GRID_FIELDS = [
  'analysisVersion',
  'meterBeatsPerBar',
  'barOneSeconds',
];

interface SongState {
  version: number;
  meter: GridMeter;
  barOne: number;
  beats: number[];
}

const BACKED_UP: SongState = {
  version: 3,
  meter: GRID_METER.triple,
  barOne: 1.25,
  beats: [0.5, 1, 1.5],
};
const LOCAL: SongState = {
  version: 4,
  meter: GRID_METER.quadruple,
  barOne: 0.5,
  beats: [0.5, 1.5],
};

const columns = (state: SongState) => ({
  beatGrid: packFloat32(state.beats),
  analysisVersion: state.version,
  meterBeatsPerBar: state.meter,
  barOneSeconds: state.barOne,
});

const expected = ({ version, meter, barOne }: SongState) => ({
  version,
  meter,
  barOne,
});

async function insertSong(database: BackupDatabase, state = BACKED_UP) {
  await database.handle.db.insert(songs).values({
    title: SONG_TITLE,
    artist: '',
    filePath: 'songs/w/waltz.mp3',
    duration: 1,
    format: 'mp3',
    createdAt: SESSION_START,
    uuid: SONG_UUID,
    analysisStatus: 'done',
    ...columns(state),
  });
}

async function setSong(database: BackupDatabase, state: SongState) {
  await database.handle.db
    .update(songs)
    .set(columns(state))
    .where(eq(songs.uuid, SONG_UUID));
}

async function stored({ handle }: BackupDatabase) {
  const [row] = await handle.db
    .select({
      version: songs.analysisVersion,
      meter: songs.meterBeatsPerBar,
      barOne: songs.barOneSeconds,
    })
    .from(songs)
    .where(eq(songs.uuid, SONG_UUID));
  return row;
}

interface BackupJson {
  librarySongs: Record<string, unknown>[];
}

function withoutSongGridFields(file: string) {
  const root = JSON.parse(file) as BackupJson;
  root.librarySongs = root.librarySongs.map((song) =>
    Object.fromEntries(
      Object.entries(song).filter(
        ([field]) => !SONG_GRID_FIELDS.includes(field),
      ),
    ),
  );
  return JSON.stringify(root);
}

async function planMerge(database: BackupDatabase, file: string) {
  return unwrap(
    await database.backup.plan(file, { categories: ['librarySongs'] }),
  );
}

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

async function backedUpThen(device: SongState) {
  const database = openBackupDatabase();
  await insertSong(database);
  const file = await database.backup.export();
  await setSong(database, device);
  return { database, file };
}

const LOCAL_OVERRIDE_ONLY: SongState = {
  ...BACKED_UP,
  meter: LOCAL.meter,
  barOne: LOCAL.barOne,
};
const LOCAL_VERSION_ONLY: SongState = { ...BACKED_UP, version: LOCAL.version };
const SONG_CONFLICT = {
  category: 'librarySongs',
  key: SONG_UUID,
  label: SONG_TITLE,
};

describe('a song grid and meter override in a backup', () => {
  it('round-trips the analysis version and the meter override', async () => {
    const source = openBackupDatabase();
    await insertSong(source);
    const target = openBackupDatabase();
    await restore(target, await source.backup.export(), 'merge');
    expect(await stored(target)).toEqual(expected(BACKED_UP));
  });

  it('writes them back under Replace', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, file, 'replace');
    expect(await stored(database)).toEqual(expected(BACKED_UP));
  });

  it('exports a stored meter it cannot play as no override', async () => {
    const database = openBackupDatabase();
    await insertSong(database);
    await database.handle.db
      .update(songs)
      .set({ meterBeatsPerBar: UNSUPPORTED_METER })
      .where(eq(songs.uuid, SONG_UUID));
    const root = JSON.parse(await database.backup.export()) as BackupJson;
    expect(root.librarySongs[0]?.meterBeatsPerBar).toBeNull();
  });

  it('restores a current-version song without owing it a re-analysis', async () => {
    const source = openBackupDatabase();
    await insertSong(source);
    const target = openBackupDatabase();
    await restore(target, await source.backup.export(), 'merge');
    const library = createSongLibraryRepository(target.handle);
    expect(await library.listOutdatedAnalyses(BACKED_UP.version)).toEqual([]);
  });
});

describe('merging a song whose override differs', () => {
  it('holds an override-only difference as a conflict', async () => {
    const { database, file } = await backedUpThen(LOCAL_OVERRIDE_ONLY);
    expect((await planMerge(database, file)).unresolved).toEqual([
      SONG_CONFLICT,
    ]);
  });

  it('takes the backed-up override on theirs', async () => {
    const { database, file } = await backedUpThen(LOCAL_OVERRIDE_ONLY);
    await restore(database, file, 'merge', 'theirs');
    expect(await stored(database)).toEqual(expected(BACKED_UP));
  });

  it('keeps the device override on mine', async () => {
    const { database, file } = await backedUpThen(LOCAL_OVERRIDE_ONLY);
    await restore(database, file, 'merge', 'mine');
    expect(await stored(database)).toEqual(expected(LOCAL_OVERRIDE_ONLY));
  });
});

describe('merging a song whose analysis version differs', () => {
  it('keeps the device version when only the version differs', async () => {
    const { database, file } = await backedUpThen(LOCAL_VERSION_ONLY);
    const plan = await planMerge(database, file);
    expect(plan.counts.librarySongs?.unchanged).toBe(1);
    await database.backup.apply(plan);
    expect(await stored(database)).toEqual(expected(LOCAL_VERSION_ONLY));
  });

  it('brings the backed-up version with a differing grid on theirs', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, file, 'merge', 'theirs');
    expect(await stored(database)).toEqual(expected(BACKED_UP));
  });
});

describe('a backup from before songs carried their grid fields', () => {
  it('keeps the device override and forgets the version under Merge', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, withoutSongGridFields(file), 'merge', 'theirs');
    expect(await stored(database)).toEqual({
      ...expected(LOCAL),
      version: null,
    });
  });

  it('keeps the device override and forgets the version under Replace', async () => {
    const { database, file } = await backedUpThen(LOCAL);
    await restore(database, withoutSongGridFields(file), 'replace');
    expect(await stored(database)).toEqual({
      ...expected(LOCAL),
      version: null,
    });
  });

  it('is not a conflict when only the missing fields differ', async () => {
    const { database, file } = await backedUpThen(LOCAL_VERSION_ONLY);
    const plan = await planMerge(database, withoutSongGridFields(file));
    expect(plan.counts.librarySongs?.unchanged).toBe(1);
  });
});

describe('song grid field validation', () => {
  const INVALID = [
    ['meterBeatsPerBar', String(UNSUPPORTED_METER)],
    ['meterBeatsPerBar', '"3"'],
    ['barOneSeconds', '-0.5'],
    ['barOneSeconds', '1e999'],
    ['analysisVersion', '-1'],
    ['analysisVersion', '1.5'],
  ] as const;

  it.each(INVALID)('refuses %s %s', async (field, value) => {
    const source = openBackupDatabase();
    await insertSong(source);
    const file = (await source.backup.export()).replace(
      new RegExp(`"${field}":[^,}]+`),
      `"${field}":${value}`,
    );
    const plan = await openBackupDatabase().backup.plan(file, {
      categories: ['librarySongs'],
    });
    expect(plan).toMatchObject({
      ok: false,
      error: { kind: 'invalidField', path: `$.librarySongs[0].${field}` },
    });
  });
});
