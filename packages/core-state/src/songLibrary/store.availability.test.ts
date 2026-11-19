import { describe, expect, it } from 'vitest';

import { rowFilesOf } from './availability.ts';
import { analysisFailure } from './logic.ts';
import {
  CODES,
  importOne,
  settle,
  setup,
  SONG_PATH,
  unversionedResult,
} from './store.test-helper.ts';

const ON_CARD = { missing: [], unavailable: [SONG_PATH], rootAvailable: false };
const BACK = { missing: [], unavailable: [], rootAvailable: true };

async function startedWithOneSong() {
  const library = setup();
  const row = await importOne(library.store);
  const stop = await library.store.getState().start();
  return { ...library, row, stop };
}

function fileFailure(library: Awaited<ReturnType<typeof startedWithOneSong>>) {
  const { store } = library;
  const { rows, rowFiles } = store.getState();
  const song = rows.find((row) => row.kind === 'song');
  if (song?.kind !== 'song') throw new Error('no song row');
  return analysisFailure(song, CODES, rowFilesOf(rowFiles, song));
}

describe('library file availability', () => {
  it('reads every row as present once started', async () => {
    const { store, row } = await startedWithOneSong();
    expect(rowFilesOf(store.getState().rowFiles, row)).toBe('present');
  });

  it('refreshes when the data folder volume changes', async () => {
    const { store, row, changeDataFolder } = await startedWithOneSong();
    changeDataFolder(ON_CARD);
    await settle();
    expect(rowFilesOf(store.getState().rowFiles, row)).toBe('unavailable');
    changeDataFolder(BACK);
    await settle();
    expect(rowFilesOf(store.getState().rowFiles, row)).toBe('present');
  });

  it('stops listening once stopped', async () => {
    const { stop, folderListeners } = await startedWithOneSong();
    expect(folderListeners.size).toBe(1);
    stop();
    expect(folderListeners.size).toBe(0);
  });

  it('shows a missing-file failure as unavailable while the card is out, then offers re-analysis once it is back', async () => {
    const library = await startedWithOneSong();
    library.changeDataFolder({
      missing: [SONG_PATH],
      unavailable: [],
      rootAvailable: true,
    });
    library.emit(
      unversionedResult({ ok: false, error: CODES.failureMissingFile }),
    );
    await settle();
    expect(fileFailure(library)?.kind).toBe('missingFile');

    library.changeDataFolder(ON_CARD);
    await settle();
    expect(fileFailure(library)?.kind).toBe('unavailable');

    library.changeDataFolder(BACK);
    await settle();
    expect(fileFailure(library)?.kind).toBe('other');
  });
});
