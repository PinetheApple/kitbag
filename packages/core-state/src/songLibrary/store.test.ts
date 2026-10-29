import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import type { ImportedAudio } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { analysisFailure, summarize } from './logic.ts';
import {
  badges,
  fakeFiles,
  importOne,
  MP3,
  result,
  settle,
  setup,
  SONG_PATH,
} from './store.test-helper.ts';

describe('song library store', () => {
  it('shows an import analyzing at once, then its grid when native reports', async () => {
    const { store, files, emit } = setup();
    await store.getState().start();
    await importOne(store);
    expect(files.importAudio).toHaveBeenCalledWith(MP3.uri, 'songs/f1');
    expect(files.enqueueAnalysis).toHaveBeenCalledWith(
      SONG_PATH,
      'songs/f1',
      false,
    );
    expect(badges(store)).toEqual([['Everlong', 'analyzing']]);
    emit(result());
    await settle();
    expect(badges(store)).toEqual([['Everlong', 'grid']]);
    expect(store.getState().rows[0]).toMatchObject({ bpm: 158 });
    expect(files.acknowledgeAnalysis).toHaveBeenCalledWith(SONG_PATH);
  });

  it('applies the same result from the event and from the stored list once', async () => {
    const { store, records } = setup();
    await importOne(store);
    await store.getState().receiveAnalysis(result());
    const once = await records.list();
    await store.getState().receiveAnalysis(result());
    expect(await records.list()).toEqual(once);
  });

  it('lands on no grid, not failure, when analysis finds no beats', async () => {
    const { store } = setup();
    await importOne(store);
    await store
      .getState()
      .receiveAnalysis(
        result({ bpm: 0, beats: [], downbeats: [], waveformRelativePath: '' }),
      );
    expect(badges(store)).toEqual([['Everlong', 'noGrid']]);
    expect(store.getState().rows[0]).toMatchObject({ bpm: null });
  });

  it('shows a failure with its reason, and re-analyzing replaces the job', async () => {
    const { store, files } = setup();
    const row = await importOne(store);
    await store
      .getState()
      .receiveAnalysis(result({ ok: false, error: 'internal' }));
    expect(badges(store)).toEqual([['Everlong', 'failed']]);
    expect(store.getState().rows[0]).toMatchObject({
      analysisError: 'internal',
    });
    await store.getState().reanalyze(row.id);
    expect(badges(store)).toEqual([['Everlong', 'analyzing']]);
    expect(files.enqueueAnalysis).toHaveBeenLastCalledWith(
      SONG_PATH,
      'songs/f1',
      true,
    );
  });

  it('keeps showing and counting the previous grid when a re-analysis fails', async () => {
    const { store } = setup();
    const row = await importOne(store);
    await store.getState().receiveAnalysis(result());
    await store.getState().reanalyze(row.id);
    await store
      .getState()
      .receiveAnalysis(result({ ok: false, error: 'unsupported' }));
    const [song] = store.getState().rows;
    if (song?.kind !== 'song') throw new Error('no song');
    expect(song).toMatchObject({ bpm: 158, hasGrid: true });
    expect(badges(store)).toEqual([['Everlong', 'grid']]);
    expect(analysisFailure(song, store.getState().codes)).toEqual({
      kind: 'unsupported',
      keptGrid: true,
    });
    expect(summarize(store.getState().rows).analyzedCount).toBe(1);
  });

  it('on start stores results that finished while away, then re-enqueues the rest', async () => {
    const fake = fakeFiles();
    const { store, records, files } = setup(fake);
    await records.insertSong({
      uuid: 'f1',
      title: 'Finished',
      artist: '',
      filePath: SONG_PATH,
      durationSec: 1,
      format: 'mp3',
    });
    await records.insertSong({
      uuid: 'f2',
      title: 'Unfinished',
      artist: '',
      filePath: 'songs/f2/Unfinished.mp3',
      durationSec: 1,
      format: 'mp3',
    });
    fake.stored.push(result());
    const unsubscribe = await store.getState().start();
    expect(files.enqueueAnalysis.mock.calls).toEqual([
      ['songs/f2/Unfinished.mp3', 'songs/f2', false],
    ]);
    expect(badges(store)).toEqual([
      ['Unfinished', 'analyzing'],
      ['Finished', 'grid'],
    ]);
    unsubscribe();
    expect(fake.listeners.size).toBe(0);
  });

  it('acknowledges a result for a deleted song and removes its new waveform', async () => {
    const { store, files } = setup();
    await store.getState().receiveAnalysis(result());
    expect(files.acknowledgeAnalysis).toHaveBeenCalledWith(SONG_PATH);
    expect(files.deleteLibraryFile.mock.calls).toEqual([
      ['songs/f1/Everlong.kwav'],
    ]);
  });

  it('does not acknowledge a result it could not store', async () => {
    const { store, files, records } = setup();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(records, 'applyAnalysis').mockRejectedValue(new Error('db'));
    await store.getState().receiveAnalysis(result());
    expect(files.acknowledgeAnalysis).not.toHaveBeenCalled();
  });

  it('does nothing when the picker is cancelled', async () => {
    const { store, files } = setup(
      fakeFiles({ pickDocument: vi.fn(() => Promise.resolve(null)) }),
    );
    await store.getState().importSong();
    expect(files.importAudio).not.toHaveBeenCalled();
    expect(store.getState().notice).toBeNull();
  });

  it('reports a failed import and keeps the library unchanged', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, files } = setup(
      fakeFiles({
        importAudio: vi.fn(() => Promise.reject(new Error('E_IMPORT_FAILED'))),
      }),
    );
    await store.getState().importSong();
    expect(store.getState().notice).toEqual({
      kind: 'copyFailed',
      name: 'Everlong.mp3',
    });
    expect(store.getState().importing).toEqual([]);
    expect(store.getState().rows).toEqual([]);
    expect(files.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('says a copied file could not be added when the database refuses it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, records, files } = setup();
    vi.spyOn(records, 'insertSong').mockRejectedValue(new Error('db'));
    await store.getState().importSong();
    expect(store.getState().notice).toEqual({
      kind: 'addFailed',
      name: 'Everlong.mp3',
    });
    expect(files.deleteSongFolder.mock.calls).toEqual([['f1']]);
    expect(files.enqueueAnalysis).not.toHaveBeenCalled();
  });

  it('refuses to import without the native library constants', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = fakeFiles();
    fake.files.constants.mockImplementation(() => {
      throw new Error('no native module');
    });
    const { store, files } = setup(fake);
    await store.getState().importSong();
    expect(files.importAudio).not.toHaveBeenCalled();
    expect(store.getState().notice).toMatchObject({ kind: 'copyFailed' });
  });

  it('tracks parallel imports separately', async () => {
    const gates: (() => void)[] = [];
    const { store } = setup(
      fakeFiles({
        importAudio: vi.fn(
          (_uri: string, dir: string) =>
            new Promise<ImportedAudio>((resolve) => {
              gates.push(() => {
                resolve({
                  relativePath: `${dir}/a.mp3`,
                  title: 'a',
                  artist: '',
                  durationSec: 1,
                });
              });
            }),
        ),
      }),
    );
    const first = store.getState().importSong();
    await vi.waitFor(() => {
      expect(gates).toHaveLength(1);
    });
    const second = store.getState().importSong();
    await vi.waitFor(() => {
      expect(gates).toHaveLength(2);
    });
    expect(store.getState().importing).toEqual([
      'Everlong.mp3',
      'Everlong.mp3',
    ]);
    gates[0]?.();
    await first;
    expect(store.getState().importing).toEqual(['Everlong.mp3']);
    gates[1]?.();
    await second;
    expect(store.getState().importing).toEqual([]);
  });

  it('deletes a song: cancels its job, then removes its own folder', async () => {
    const { store, files } = setup();
    const row = await importOne(store);
    await store.getState().deleteRow(row);
    expect(store.getState().rows).toEqual([]);
    expect(files.cancelAnalysis).toHaveBeenCalledWith(SONG_PATH);
    expect(files.deleteSongFolder.mock.calls).toEqual([['f1']]);
    expect(files.deleteLibraryFile).not.toHaveBeenCalled();
  });

  it('deletes a restored row’s files one by one, never a folder it did not create', async () => {
    const { store, records, files } = setup();
    await records.insertSong({
      uuid: 'from-another-phone',
      title: 'Restored',
      artist: '',
      filePath: 'songs/f9/Restored.mp3',
      durationSec: 1,
      format: 'mp3',
    });
    await store.getState().refresh();
    const [row] = store.getState().rows;
    if (row === undefined) throw new Error('no row');
    await store.getState().deleteRow(row);
    expect(files.deleteSongFolder).not.toHaveBeenCalled();
    expect(files.deleteLibraryFile.mock.calls).toEqual([
      ['songs/f9/Restored.mp3'],
    ]);
  });

  it('marks a song in a setlist only through a preset in one', async () => {
    const { store, records, handle } = setup();
    const id = await records.insertSong({
      uuid: 'x',
      title: 'Listed',
      artist: '',
      filePath: 'songs/x/a.mp3',
      durationSec: 1,
      format: 'mp3',
    });
    const sets = createSetlistRepository(handle);
    const preset = await createSongPresetRepository(handle).create({
      name: 'Listed',
      bpm: 120,
      beatsPerBar: 4,
      subdivision: 1,
      accents: new Uint8Array([2, 1, 1, 1]),
      polyEnabled: false,
      polyBeats: 0,
      sound: 0,
      librarySongId: id,
    });
    const setlist = await sets.create('Gig');
    await sets.add(setlist.id, preset.id);
    await store.getState().refresh();
    expect(store.getState().rows[0]).toMatchObject({ inSetlist: true });
  });
});
