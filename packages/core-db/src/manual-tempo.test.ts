import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { GRID_METER, NO_METER_OVERRIDE } from './meter-override';
import { bundle } from './backup-stem-songs.test-helper';
import { songs, stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import { openTestDatabase } from './sqlite.test-helper';
import { TEMPO_CORRECTION } from './tempo-correction';
import { TEMPO_MAX_BPM, TEMPO_MIN_BPM } from './tempo-mode';

const ANALYSIS_VERSION = 3;
const ANALYSED_BPM = 132;
const OVERRIDE = { meterBeatsPerBar: GRID_METER.triple, barOneSeconds: 2.75 };
const MANUAL = { bpm: 127.6, anchor: 2.3, beatsPerBar: GRID_METER.quadruple };
const BPM_STEP = 0.1;

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, library: createSongLibraryRepository(handle) };
}

type Library = ReturnType<typeof setup>['library'];

const PATH = 'songs/uuid-drift/drift.mp3';

const analysedResult = (beats: readonly number[]) => ({
  filePath: PATH,
  ok: true as const,
  bpm: beats.length > 0 ? ANALYSED_BPM : null,
  beats,
  downbeats: beats.length > 0 ? [0] : [],
  waveformPath: null,
  durationSec: null,
  analysisVersion: ANALYSIS_VERSION,
});

async function song(library: Library, beats: readonly number[] = []) {
  const id = await library.insertSong({
    uuid: 'uuid-drift',
    title: 'Drift',
    artist: 'Band',
    filePath: PATH,
    durationSec: 240,
    format: 'mp3',
  });
  await library.applyAnalysis(analysedResult(beats));
  return id;
}

const songRow = (library: Library, id: number) =>
  library
    .list()
    .then((rows) => rows.find((row) => row.kind === 'song' && row.id === id));

describe('a song manual tempo', () => {
  it('is stored beside the analysed grid and clears the meter override', async () => {
    const { library } = setup();
    const id = await song(library, [0.5, 1, 1.5]);
    await library.saveSongMeterOverride(id, OVERRIDE);
    await library.saveSongManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    expect(await library.readSong(id)).toMatchObject({
      manualTempo: MANUAL,
      ...NO_METER_OVERRIDE,
      bpm: ANALYSED_BPM,
      beats: [0.5, 1, 1.5],
    });
  });

  it('goes back to none with the meter override it replaced', async () => {
    const { library } = setup();
    const id = await song(library, [0.5, 1]);
    await library.saveSongManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    await library.saveSongManualTempo(id, {
      manualTempo: null,
      meterOverride: OVERRIDE,
    });
    expect(await library.readSong(id)).toMatchObject({
      manualTempo: null,
      ...OVERRIDE,
    });
  });

  it('reads none for a song that never had one', async () => {
    const { library } = setup();
    const id = await song(library);
    expect((await library.readSong(id))?.manualTempo).toBeNull();
  });

  it.each([
    ['bpm below the range', { ...MANUAL, bpm: TEMPO_MIN_BPM - BPM_STEP }],
    ['bpm above the range', { ...MANUAL, bpm: TEMPO_MAX_BPM + BPM_STEP }],
    ['bpm not a number', { ...MANUAL, bpm: Number.NaN }],
    ['bar 1 before the start', { ...MANUAL, anchor: -0.01 }],
    ['bar 1 not finite', { ...MANUAL, anchor: Number.POSITIVE_INFINITY }],
    ['an unsupported meter', { ...MANUAL, beatsPerBar: 5 }],
  ])('refuses %s and stores nothing', async (_name, manualTempo) => {
    const { library } = setup();
    const id = await song(library);
    await expect(
      library.saveSongManualTempo(id, {
        manualTempo: manualTempo as typeof MANUAL,
        meterOverride: NO_METER_OVERRIDE,
      }),
    ).rejects.toThrow(RangeError);
    expect((await library.readSong(id))?.manualTempo).toBeNull();
  });

  it('refuses a meter override the meter sheet could not have set', async () => {
    const { library } = setup();
    const id = await song(library);
    await expect(
      library.saveSongManualTempo(id, {
        manualTempo: MANUAL,
        meterOverride: { meterBeatsPerBar: 5 as 4, barOneSeconds: null },
      }),
    ).rejects.toThrow(RangeError);
    expect((await library.readSong(id))?.manualTempo).toBeNull();
  });

  it('reads a partly stored manual tempo as none', async () => {
    const { handle, library } = setup();
    const id = await song(library);
    await handle.db
      .update(songs)
      .set({ manualTempoBpm: MANUAL.bpm, manualTempoAnchor: null })
      .where(eq(songs.id, id));
    expect((await library.readSong(id))?.manualTempo).toBeNull();
  });

  it.each([
    ['a new grid', analysedResult([0.4, 0.9, 1.4])],
    ['no beat found', analysedResult([])],
    [
      'a failed re-analysis',
      { filePath: PATH, ok: false as const, error: 'internal' },
    ],
  ])('survives %s', async (_name, result) => {
    const { library } = setup();
    const id = await song(library, [0.5, 1]);
    await library.saveSongManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    await library.beginAnalysis(id);
    await library.applyAnalysis(result);
    expect((await library.readSong(id))?.manualTempo).toEqual(MANUAL);
  });

  it('keeps the new analysed grid behind the manual tempo', async () => {
    const { library } = setup();
    const id = await song(library);
    await library.saveSongManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    await library.beginAnalysis(id);
    await library.applyAnalysis(analysedResult([0.5, 1.25]));
    expect(await library.readSong(id)).toMatchObject({
      bpm: ANALYSED_BPM,
      beats: [0.5, 1.25],
      manualTempo: MANUAL,
    });
  });

  it('lists a song with no grid as gridded at the manual tempo, uncorrected', async () => {
    const { library } = setup();
    const id = await song(library);
    await library.saveSongTempoCorrection(id, TEMPO_CORRECTION.double);
    await library.saveSongManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    expect(await songRow(library, id)).toMatchObject({
      hasGrid: true,
      bpm: MANUAL.bpm,
      tempoCorrection: TEMPO_CORRECTION.none,
    });
    expect((await library.readSong(id))?.tempoCorrection).toBe(
      TEMPO_CORRECTION.double,
    );
  });
});

describe('a stem song manual tempo', () => {
  async function stemSet({ handle }: ReturnType<typeof setup>) {
    const [set] = await handle.db
      .insert(stemSets)
      .values({ name: 'Redbone', createdAt: new Date(0), uuid: 'uuid-r' })
      .returning();
    if (set === undefined) throw new Error('stem set insert');
    return set.id;
  }

  it('is stored, read and listed', async () => {
    const database = setup();
    const id = await stemSet(database);
    await database.library.saveStemSetManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    expect((await database.library.readStemSet(id))?.manualTempo).toEqual(
      MANUAL,
    );
    const rows = await database.library.list();
    expect(rows.find((row) => row.kind === 'stems')).toMatchObject({
      hasGrid: true,
      bpm: MANUAL.bpm,
    });
  });
});

describe('a stem song manual tempo on a re-import', () => {
  const JOB = 'job-manual';

  it.each([
    ['keeps it for the same job', JOB, MANUAL],
    ['drops it for another job', 'job-other', null],
  ])('%s', async (_name, jobId, kept) => {
    const { library } = setup();
    const id = await library.insertStemBundle(bundle(JOB));
    await library.saveStemSetManualTempo(id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    const replaced = await library.replaceStemBundle(bundle(jobId), id);
    expect((await library.readStemSet(replaced.id))?.manualTempo).toEqual(kept);
  });
});
