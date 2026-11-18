import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { GRID_METER, type GridMeter } from './meter-override';
import { songs, stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import { openTestDatabase } from './sqlite.test-helper';

const OLD_VERSION = 1;
const CURRENT_VERSION = 2;

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, library: createSongLibraryRepository(handle) };
}

const path = (title: string) => `songs/uuid-${title}/${title}.mp3`;

const song = (title: string) => ({
  uuid: `uuid-${title}`,
  title,
  artist: 'Artist',
  filePath: path(title),
  durationSec: 200,
  format: 'mp3',
});

const okResult = (title: string, analysisVersion: number) => ({
  filePath: path(title),
  ok: true as const,
  bpm: 120,
  beats: [0.5, 1, 1.5],
  downbeats: [0],
  waveformPath: null,
  durationSec: null,
  analysisVersion,
});

const failure = (title: string) => ({
  filePath: path(title),
  ok: false as const,
  error: 'internal',
});

async function analysed(
  library: ReturnType<typeof setup>['library'],
  title: string,
  version: number,
) {
  const id = await library.insertSong(song(title));
  await library.applyAnalysis(okResult(title, version));
  return id;
}

describe('analysis version', () => {
  it('stamps the version that produced a stored grid', async () => {
    const { handle, library } = setup();
    const id = await analysed(library, 'A', CURRENT_VERSION);
    const [row] = await handle.db.select().from(songs).where(eq(songs.id, id));
    expect(row?.analysisVersion).toBe(CURRENT_VERSION);
  });

  it('stores no version for a grid from a binary that did not report one', async () => {
    const { handle, library } = setup();
    const id = await library.insertSong(song('Legacy'));
    await library.applyAnalysis({ ...okResult('Legacy', 0), analysisVersion: null });
    const [row] = await handle.db.select().from(songs).where(eq(songs.id, id));
    expect(row?.analysisVersion).toBeNull();
    expect(await library.listOutdatedAnalyses(CURRENT_VERSION)).toEqual([id]);
  });

  it('keeps the old version when a re-analysis fails', async () => {
    const { handle, library } = setup();
    const id = await analysed(library, 'A', OLD_VERSION);
    await library.beginAnalysis(id);
    await library.applyAnalysis(failure('A'));
    const [row] = await handle.db.select().from(songs).where(eq(songs.id, id));
    expect(row).toMatchObject({
      analysisVersion: OLD_VERSION,
      analysisStatus: 'failed',
    });
  });

  it('lists finished songs below the current version, unversioned ones included, in id order', async () => {
    const { handle, library } = setup();
    const unversioned = await analysed(library, 'Unversioned', OLD_VERSION);
    await handle.db
      .update(songs)
      .set({ analysisVersion: null })
      .where(eq(songs.id, unversioned));
    const old = await analysed(library, 'Old', OLD_VERSION);
    await analysed(library, 'Current', CURRENT_VERSION);
    expect(await library.listOutdatedAnalyses(CURRENT_VERSION)).toEqual([
      unversioned,
      old,
    ]);
  });

  it('leaves out songs that are pending, analysing or failed', async () => {
    const { handle, library } = setup();
    await library.insertSong(song('Analysing'));
    const pending = await library.insertSong(song('Pending'));
    await handle.db
      .update(songs)
      .set({ analysisStatus: 'pending' })
      .where(eq(songs.id, pending));
    await analysed(library, 'Failed', OLD_VERSION);
    await library.applyAnalysis(failure('Failed'));
    expect(await library.listOutdatedAnalyses(CURRENT_VERSION)).toEqual([]);
  });
});

describe('meter override', () => {
  it('saves the meter and bar one independently and clears each on its own', async () => {
    const { library } = setup();
    const id = await analysed(library, 'Waltz', CURRENT_VERSION);
    await library.saveSongMeterOverride(id, {
      meterBeatsPerBar: GRID_METER.triple,
    });
    await library.saveSongMeterOverride(id, { barOneSeconds: 1.5 });
    expect(await library.readSong(id)).toMatchObject({
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: 1.5,
    });
    await library.saveSongMeterOverride(id, { meterBeatsPerBar: null });
    expect(await library.readSong(id)).toMatchObject({
      meterBeatsPerBar: null,
      barOneSeconds: 1.5,
    });
  });

  it.each([
    { meterBeatsPerBar: 5 as GridMeter },
    { barOneSeconds: -1 },
    { barOneSeconds: Number.NaN },
    { barOneSeconds: Number.POSITIVE_INFINITY },
  ])('refuses %o and stores nothing', async (patch) => {
    const { library } = setup();
    const id = await analysed(library, 'Waltz', CURRENT_VERSION);
    await expect(library.saveSongMeterOverride(id, patch)).rejects.toThrow(
      RangeError,
    );
    expect(await library.readSong(id)).toMatchObject({
      meterBeatsPerBar: null,
      barOneSeconds: null,
    });
  });

  it('saves a stem song override', async () => {
    const { handle, library } = setup();
    const [set] = await handle.db
      .insert(stemSets)
      .values({ name: 'Redbone', createdAt: new Date(0), uuid: 'uuid-r' })
      .returning();
    if (set === undefined) throw new Error('stem set insert');
    await library.saveStemSetMeterOverride(set.id, {
      meterBeatsPerBar: GRID_METER.quadruple,
      barOneSeconds: 0.25,
    });
    expect(await library.readStemSet(set.id)).toMatchObject({
      meterBeatsPerBar: GRID_METER.quadruple,
      barOneSeconds: 0.25,
    });
  });

  it.each([
    ['a new grid', (title: string) => okResult(title, CURRENT_VERSION)],
    ['a failed re-analysis', failure],
  ])('survives %s', async (_name, result) => {
    const { library } = setup();
    const id = await analysed(library, 'Waltz', OLD_VERSION);
    await library.saveSongMeterOverride(id, {
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: 2.75,
    });
    await library.beginAnalysis(id);
    await library.applyAnalysis(result('Waltz'));
    expect(await library.readSong(id)).toMatchObject({
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: 2.75,
    });
  });
});
