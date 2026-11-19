import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { ImportMode, Resolution } from './backup-format';
import {
  openBackupDatabase,
  SESSION_START,
  type BackupDatabase,
  unwrap,
} from './backup.test-helper';
import { GRID_METER } from './meter-override';
import { packFloat32 } from './packing';
import { songs } from './schema';

const SONG_UUID = 'c41d7e2a-5b6f-4f0e-8a3b-2d9c1e7f6a50';
const BACKED_UP_VERSION = 3;
const LOCAL_VERSION = 4;
const BACKED_UP_BAR_ONE = 1.25;
const LOCAL_BAR_ONE = 0.5;
const BACKED_UP_BEATS = [0.5, 1, 1.5];
const LOCAL_BEATS = [0.5, 1.5];
const V20_FIELDS = ['analysisVersion', 'meterBeatsPerBar', 'barOneSeconds'];

const BACKED_UP = {
  version: BACKED_UP_VERSION,
  meter: GRID_METER.triple,
  barOne: BACKED_UP_BAR_ONE,
};
const LOCAL = {
  version: LOCAL_VERSION,
  meter: GRID_METER.quadruple,
  barOne: LOCAL_BAR_ONE,
};

async function insertSong(database: BackupDatabase, beats: number[]) {
  await database.handle.db.insert(songs).values({
    title: 'Waltz',
    artist: '',
    filePath: 'songs/w/waltz.mp3',
    duration: 1,
    format: 'mp3',
    createdAt: SESSION_START,
    uuid: SONG_UUID,
    beatGrid: packFloat32(beats),
    analysisStatus: 'done',
    analysisVersion: BACKED_UP_VERSION,
    meterBeatsPerBar: GRID_METER.triple,
    barOneSeconds: BACKED_UP_BAR_ONE,
  });
}

async function setLocal(database: BackupDatabase, beats: number[]) {
  await database.handle.db
    .update(songs)
    .set({
      beatGrid: packFloat32(beats),
      analysisVersion: LOCAL_VERSION,
      meterBeatsPerBar: GRID_METER.quadruple,
      barOneSeconds: LOCAL_BAR_ONE,
    })
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

function withoutV20Fields(file: string) {
  const root = JSON.parse(file) as {
    librarySongs: Record<string, unknown>[];
  };
  root.librarySongs = root.librarySongs.map((song) =>
    Object.fromEntries(
      Object.entries(song).filter(([field]) => !V20_FIELDS.includes(field)),
    ),
  );
  return JSON.stringify(root);
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

async function backedUpThenDiverged(beats: number[]) {
  const database = openBackupDatabase();
  await insertSong(database, BACKED_UP_BEATS);
  const file = await database.backup.export();
  await setLocal(database, beats);
  return { database, file };
}

describe('a song grid and meter override in a backup', () => {
  it('round-trips the analysis version and the meter override', async () => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP_BEATS);
    const target = openBackupDatabase();
    await restore(target, await source.backup.export(), 'merge');
    expect(await stored(target)).toEqual(BACKED_UP);
  });

  it('writes them back under Replace', async () => {
    const { database, file } = await backedUpThenDiverged(LOCAL_BEATS);
    await restore(database, file, 'replace');
    expect(await stored(database)).toEqual(BACKED_UP);
  });

  it('holds a differing override as a conflict until resolved', async () => {
    const { database, file } = await backedUpThenDiverged(BACKED_UP_BEATS);
    const plan = unwrap(
      await database.backup.plan(file, { categories: ['librarySongs'] }),
    );
    expect(plan.unresolved).toEqual([
      { category: 'librarySongs', key: SONG_UUID, label: 'Waltz' },
    ]);
  });

  it('takes the backed-up override when the conflict resolves to theirs', async () => {
    const { database, file } = await backedUpThenDiverged(BACKED_UP_BEATS);
    await restore(database, file, 'merge', 'theirs');
    expect(await stored(database)).toEqual(BACKED_UP);
  });

  it('keeps the local override when the conflict resolves to mine', async () => {
    const { database, file } = await backedUpThenDiverged(BACKED_UP_BEATS);
    await restore(database, file, 'merge', 'mine');
    expect(await stored(database)).toEqual(LOCAL);
  });
});

describe('a backup from before songs carried their grid fields', () => {
  it('keeps the device override and forgets the version under Merge', async () => {
    const { database, file } = await backedUpThenDiverged(LOCAL_BEATS);
    await restore(database, withoutV20Fields(file), 'merge', 'theirs');
    expect(await stored(database)).toEqual({ ...LOCAL, version: null });
  });

  it('keeps the device override and forgets the version under Replace', async () => {
    const { database, file } = await backedUpThenDiverged(LOCAL_BEATS);
    await restore(database, withoutV20Fields(file), 'replace');
    expect(await stored(database)).toEqual({ ...LOCAL, version: null });
  });

  it('is not a conflict over the version alone', async () => {
    const { database, file } = await backedUpThenDiverged(BACKED_UP_BEATS);
    const old = JSON.parse(withoutV20Fields(file)) as {
      librarySongs: Record<string, unknown>[];
    };
    for (const song of old.librarySongs) {
      song.meterBeatsPerBar = GRID_METER.quadruple;
      song.barOneSeconds = LOCAL_BAR_ONE;
    }
    const plan = unwrap(
      await database.backup.plan(JSON.stringify(old), {
        categories: ['librarySongs'],
      }),
    );
    expect(plan.counts.librarySongs?.unchanged).toBe(1);
  });
});

describe('song grid field validation', () => {
  const INVALID = [
    ['meterBeatsPerBar', '5'],
    ['meterBeatsPerBar', '"3"'],
    ['barOneSeconds', '-0.5'],
    ['barOneSeconds', '1e999'],
    ['analysisVersion', '-1'],
    ['analysisVersion', '1.5'],
  ] as const;

  it.each(INVALID)('refuses %s %s', async (field, value) => {
    const source = openBackupDatabase();
    await insertSong(source, BACKED_UP_BEATS);
    const file = (await source.backup.export()).replace(
      new RegExp(`"${field}":[^,}]+`),
      `"${field}":${value}`,
    );
    const plan = await openBackupDatabase().backup.plan(file, {
      categories: ['librarySongs'],
    });
    expect(plan).toMatchObject({
      ok: false,
      error: {
        kind: 'invalidField',
        path: `$.librarySongs[0].${field}`,
      },
    });
  });
});
