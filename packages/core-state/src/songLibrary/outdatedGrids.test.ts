import { GRID_METER } from '@kitbag/core-db';
import { KB_BEAT_ANALYSIS_VERSION } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { createSongLibraryStore } from './store.ts';
import {
  badges,
  failedResult,
  fakeFitter,
  fakeOpenSong,
  result,
  settle,
  setup,
  unversionedResult,
} from './store.test-helper.ts';

const OLD_VERSION = KB_BEAT_ANALYSIS_VERSION - 1;

type Library = ReturnType<typeof setup>;

const path = (title: string) => `songs/${title}/${title}.mp3`;

const insertSong = ({ records }: Library, title: string) =>
  records.insertSong({
    uuid: title,
    title,
    artist: '',
    filePath: path(title),
    durationSec: 1,
    format: 'mp3',
  });

async function analysedSong(
  library: Library,
  title: string,
  analysisVersion: number,
) {
  const id = await insertSong(library, title);
  await library.records.applyAnalysis({
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

const storeThenQueueNext = async () => {
  await settle();
  await settle();
};

const finish = async (
  library: Library,
  title: string,
  analysisVersion = KB_BEAT_ANALYSIS_VERSION,
) => {
  library.emit(
    result({
      relativePath: path(title),
      waveformRelativePath: '',
      analysisVersion,
    }),
  );
  await storeThenQueueNext();
};

const fail = async (library: Library, title: string) => {
  library.emit(failedResult({ relativePath: path(title) }));
  await storeThenQueueNext();
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
    await fail(library, 'Broken');
    expect(badges(library.store)).toEqual([['Broken', 'grid']]);
    const relaunched = createSongLibraryStore({
      records: () => library.records,
      files: () => library.files,
      newUuid: () => 'unused',
      openSong: () => fakeOpenSong().openSong,
      fitTempo: () => fakeFitter(),
    });
    await relaunched.getState().start();
    expect(queued(library)).toEqual([path('Broken')]);
  });

  it('tries a song once per session even if its result still reads as older', async () => {
    const library = setup();
    await analysedSong(library, 'Stuck', OLD_VERSION);
    await library.store.getState().start();
    await finish(library, 'Stuck', OLD_VERSION);
    expect(queued(library)).toEqual([path('Stuck')]);
  });

  it('stores the version the native analysis reported', async () => {
    const library = setup();
    const id = await insertSong(library, 'Fresh');
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
    await insertSong(library, 'Away');
    library.stored.push(unversionedResult({ relativePath: path('Away') }));
    await library.store.getState().start();
    expect(queued(library)).toEqual([path('Away')]);
  });

  it('does not queue a song whose only analysis failed', async () => {
    const library = setup();
    await insertSong(library, 'Failed');
    library.stored.push(failedResult({ relativePath: path('Failed') }));
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

  it('skips the song open in the player and queues it once the player closes', async () => {
    const library = setup();
    const open = await analysedSong(library, 'Open', OLD_VERSION);
    library.setOpenSong(open);
    await library.store.getState().start();
    expect(queued(library)).toEqual([]);
    library.setOpenSong(null);
    await storeThenQueueNext();
    expect(queued(library)).toEqual([path('Open')]);
  });

  it('still re-analyses the open song when asked by hand', async () => {
    const library = setup();
    const open = await analysedSong(library, 'Open', OLD_VERSION);
    library.setOpenSong(open);
    await library.store.getState().start();
    await library.store.getState().reanalyze(open);
    expect(queued(library)).toEqual([path('Open')]);
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
