import { GRID_METER } from '@kitbag/core-db';
import { KB_BEAT_ANALYSIS_VERSION } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { createSongLibraryStore } from './store.ts';
import {
  badges,
  legacyResult,
  result,
  settle,
  setup,
} from './store.test-helper.ts';

const OLD_VERSION = KB_BEAT_ANALYSIS_VERSION - 1;

type Library = ReturnType<typeof setup>;

const path = (title: string) => `songs/${title}/${title}.mp3`;

async function analysedSong(
  { records }: Library,
  title: string,
  analysisVersion: number,
) {
  const id = await records.insertSong({
    uuid: title,
    title,
    artist: '',
    filePath: path(title),
    durationSec: 1,
    format: 'mp3',
  });
  await records.applyAnalysis({
    filePath: path(title),
    ok: true,
    bpm: 120,
    beats: [0.5, 1],
    downbeats: [0],
    waveformPath: null,
    durationSec: null,
    analysisVersion,
  });
  return id;
}

// The launch claim of unfinished songs enqueues without replacing; this queue replaces.
const queued = ({ files }: Library) =>
  files.enqueueAnalysis.mock.calls
    .filter(([, , replace]) => replace)
    .map(([songPath]) => songPath);

const finish = async (library: Library, title: string, ok = true) => {
  const fields = { relativePath: path(title), waveformRelativePath: '' };
  library.emit(
    ok
      ? result(fields)
      : legacyResult({ ...fields, ok: false, error: 'internal' }),
  );
  await settle();
  await settle();
};

describe('re-analysing grids from an older analyser', () => {
  it('queues each older song once, oldest first, one at a time', async () => {
    const library = setup();
    await analysedSong(library, 'First', OLD_VERSION);
    await analysedSong(library, 'Current', KB_BEAT_ANALYSIS_VERSION);
    await analysedSong(library, 'Second', OLD_VERSION);
    await library.store.getState().start();
    await library.store.getState().start();
    expect(queued(library)).toEqual([path('First')]);
    expect(badges(library.store)).toEqual([
      ['Second', 'grid'],
      ['Current', 'grid'],
      ['First', 'analyzing'],
    ]);
    await finish(library, 'First');
    expect(queued(library)).toEqual([path('First'), path('Second')]);
    await finish(library, 'Second');
    expect(queued(library)).toEqual([path('First'), path('Second')]);
  });

  it('queues nothing when every grid is current', async () => {
    const library = setup();
    await analysedSong(library, 'Current', KB_BEAT_ANALYSIS_VERSION);
    await library.store.getState().start();
    expect(queued(library)).toEqual([]);
  });

  it('keeps the old grid after a failure and does not retry it on the next launch', async () => {
    const library = setup();
    await analysedSong(library, 'Broken', OLD_VERSION);
    await library.store.getState().start();
    await finish(library, 'Broken', false);
    expect(badges(library.store)).toEqual([['Broken', 'grid']]);
    const relaunched = createSongLibraryStore({
      records: () => library.records,
      files: () => library.files,
      newUuid: () => 'unused',
    });
    await relaunched.getState().start();
    expect(queued(library)).toEqual([path('Broken')]);
  });

  it('stores the version the native analysis reported', async () => {
    const library = setup();
    const id = await library.records.insertSong({
      uuid: 'Fresh',
      title: 'Fresh',
      artist: '',
      filePath: path('Fresh'),
      durationSec: 1,
      format: 'mp3',
    });
    await library.store.getState().receiveAnalysis(
      result({
        relativePath: path('Fresh'),
        analysisVersion: KB_BEAT_ANALYSIS_VERSION,
      }),
    );
    const { listOutdatedAnalyses } = library.records;
    expect(await listOutdatedAnalyses(KB_BEAT_ANALYSIS_VERSION)).toEqual([]);
    expect(await listOutdatedAnalyses(KB_BEAT_ANALYSIS_VERSION + 1)).toEqual([
      id,
    ]);
  });

  it('re-analyses a grid the old binary finished while the app was away', async () => {
    const library = setup();
    await library.records.insertSong({
      uuid: 'Away',
      title: 'Away',
      artist: '',
      filePath: path('Away'),
      durationSec: 1,
      format: 'mp3',
    });
    library.stored.push(legacyResult({ relativePath: path('Away') }));
    await library.store.getState().start();
    expect(queued(library)).toEqual([path('Away')]);
  });

  it('does not queue a song whose only analysis failed', async () => {
    const library = setup();
    await library.records.insertSong({
      uuid: 'Failed',
      title: 'Failed',
      artist: '',
      filePath: path('Failed'),
      durationSec: 1,
      format: 'mp3',
    });
    library.stored.push(
      legacyResult({ relativePath: path('Failed'), ok: false, error: 'internal' }),
    );
    await library.store.getState().start();
    expect(queued(library)).toEqual([]);
    expect(badges(library.store)).toEqual([['Failed', 'failed']]);
  });

  it('moves on when the song being re-analysed is deleted', async () => {
    const library = setup();
    await analysedSong(library, 'Deleted', OLD_VERSION);
    await analysedSong(library, 'Next', OLD_VERSION);
    await library.store.getState().start();
    const row = library.store
      .getState()
      .rows.find(({ title }) => title === 'Deleted');
    if (row === undefined) throw new Error('no row');
    await library.store.getState().deleteRow(row);
    expect(queued(library)).toEqual([path('Deleted'), path('Next')]);
  });

  it('keeps the meter override through the re-analysis', async () => {
    const library = setup();
    const id = await analysedSong(library, 'Waltz', OLD_VERSION);
    await library.records.saveSongMeterOverride(id, {
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: 1,
    });
    await library.store.getState().start();
    await finish(library, 'Waltz');
    expect(await library.records.readSong(id)).toMatchObject({
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: 1,
    });
    expect(
      await library.records.listOutdatedAnalyses(KB_BEAT_ANALYSIS_VERSION),
    ).toEqual([]);
  });
});
