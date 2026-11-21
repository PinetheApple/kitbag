import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op-engineering/op-sqlite', () => ({}));

import { songs, stemSets } from './schema';
import { createSongLibraryRepository } from './song-library-repository';
import type { NewStemBundle } from './stem-bundle-repository';
import type { BundleTempo } from './stem-tempo';
import { openTestDatabase } from './sqlite.test-helper';
import { TEMPO_MODE, TEMPO_SOURCE } from './tempo-mode';

const open: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of open.splice(0)) connection.close();
});

function setup() {
  const handle = openTestDatabase();
  open.push(handle);
  return { handle, library: createSongLibraryRepository(handle) };
}

const FILE = 'songs/uuid-drift/drift.mp3';

const FIT: BundleTempo = {
  mode: TEMPO_MODE.follow,
  bpm: 121.5,
  anchor: 0.25,
  beatsPerBar: 4,
  source: TEMPO_SOURCE.analysed,
};

const UNTIMED: BundleTempo = { ...FIT, bpm: null, anchor: null };

const analysis = (tempo?: BundleTempo | null) => ({
  filePath: FILE,
  ok: true as const,
  bpm: 121,
  beats: [0.25, 0.75],
  downbeats: [0],
  waveformPath: null,
  durationSec: null,
  analysisVersion: 1,
  ...(tempo === undefined ? {} : { tempo }),
});

async function analysedSong(tempo?: BundleTempo | null) {
  const { handle, library } = setup();
  const id = await library.insertSong({
    uuid: 'uuid-drift',
    title: 'Drift',
    artist: '',
    filePath: FILE,
    durationSec: 200,
    format: 'mp3',
  });
  await library.applyAnalysis(analysis(tempo));
  return { handle, library, id };
}

const BUNDLE: NewStemBundle = {
  uuid: 'set-uuid',
  jobId: 'set-job',
  title: 'Set',
  songTitle: null,
  artist: null,
  folder: 'stems/set',
  sampleRate: 44100,
  channels: 2,
  stems: [],
  hasMix: false,
  bpm: 120,
  key: null,
  scale: null,
  keyConfidence: null,
  loudnessLufs: null,
  tempoStability: null,
  sections: [],
  lyrics: null,
  beats: [0.5, 1],
  bars: [{ beat: 0, beatsPerBar: 3 }],
  tempo: null,
};

describe('a song analysed with a tempo fit', () => {
  it('reads the fit back as a follow tempo with no chosen mode', async () => {
    const { library, id } = await analysedSong(FIT);
    expect(await library.readSong(id)).toMatchObject({
      tempo: FIT,
      chosenTempoMode: null,
    });
  });

  it('reads back a fit that found no steady tempo', async () => {
    const { library, id } = await analysedSong(UNTIMED);
    expect(await library.readSong(id)).toMatchObject({ tempo: UNTIMED });
  });

  it('drops the old fit when a new analysis brings none', async () => {
    const { handle, library, id } = await analysedSong(FIT);
    await library.applyAnalysis(analysis());
    expect(await library.readSong(id)).toMatchObject({ tempo: null });
    const [row] = await handle.db.select().from(songs);
    expect(row).toMatchObject({ tempoMode: null, tempoBpm: null });
  });

  it('refuses to store a bad fit, keeping the previous analysis', async () => {
    const { library, id } = await analysedSong(FIT);
    await expect(
      library.applyAnalysis(analysis({ ...FIT, bpm: 900 })),
    ).rejects.toThrow(RangeError);
    expect(await library.readSong(id)).toMatchObject({ tempo: FIT });
  });

  it('saves a chosen mode and clears it back to the fitted mode', async () => {
    const { library, id } = await analysedSong(FIT);
    await library.saveSongChosenTempoMode(id, TEMPO_MODE.constant);
    expect(await library.readSong(id)).toMatchObject({
      chosenTempoMode: TEMPO_MODE.constant,
    });
    await library.saveSongChosenTempoMode(id, null);
    expect(await library.readSong(id)).toMatchObject({
      chosenTempoMode: null,
    });
  });

  it('refuses Constant tempo for a song with no fit, writing nothing', async () => {
    const { library, id } = await analysedSong(UNTIMED);
    await expect(
      library.saveSongChosenTempoMode(id, TEMPO_MODE.constant),
    ).rejects.toThrow(RangeError);
    expect(await library.readSong(id)).toMatchObject({
      chosenTempoMode: null,
    });
  });

  it('keeps a chosen mode through a re-analysis that can build it', async () => {
    const { library, id } = await analysedSong(FIT);
    await library.saveSongChosenTempoMode(id, TEMPO_MODE.constant);
    await library.applyAnalysis(analysis({ ...FIT, bpm: 122 }));
    expect(await library.readSong(id)).toMatchObject({
      chosenTempoMode: TEMPO_MODE.constant,
    });
    await library.applyAnalysis(analysis(UNTIMED));
    expect(await library.readSong(id)).toMatchObject({
      chosenTempoMode: null,
    });
  });
});

describe('stem songs with beats but no tempo', () => {
  it('lists only stem songs with beats and no tempo', async () => {
    const { library } = setup();
    const untimed = await library.insertStemBundle(BUNDLE);
    await library.insertStemBundle({
      ...BUNDLE,
      uuid: 'timed',
      jobId: 'timed',
      tempo: { ...FIT, source: TEMPO_SOURCE.detected },
    });
    await library.insertStemBundle({
      ...BUNDLE,
      uuid: 'beatless',
      jobId: 'beatless',
      beats: [],
      bars: [],
    });
    expect(await library.listStemSetsWithoutTempo()).toEqual([
      { id: untimed, beats: BUNDLE.beats, bars: BUNDLE.bars },
    ]);
  });

  it('stores a fit once, leaving a tempo already there alone', async () => {
    const { handle, library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await library.saveStemSetTempo(id, FIT);
    expect(await library.readStemSet(id)).toMatchObject({ tempo: FIT });
    expect(await library.listStemSetsWithoutTempo()).toEqual([]);
    await library.saveStemSetTempo(id, UNTIMED);
    const [row] = await handle.db
      .select({ bpm: stemSets.tempoBpm })
      .from(stemSets)
      .where(eq(stemSets.id, id));
    expect(row?.bpm).toBe(FIT.bpm);
  });

  it('refuses a bad fit, writing nothing', async () => {
    const { library } = setup();
    const id = await library.insertStemBundle(BUNDLE);
    await expect(
      library.saveStemSetTempo(id, { ...FIT, beatsPerBar: 0 }),
    ).rejects.toThrow(RangeError);
    expect(await library.readStemSet(id)).toMatchObject({ tempo: null });
  });
});
