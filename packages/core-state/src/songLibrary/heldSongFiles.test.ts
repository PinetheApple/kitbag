import { describe, expect, it, vi } from 'vitest';

import {
  fakeFiles,
  fakeFitter,
  importOne,
  JOB_ID,
  setup,
} from './store.test-helper.ts';
import { createSongLibraryStore } from './store.ts';

type Env = ReturnType<typeof setup>;

function relaunch(env: Env, fake = fakeFiles()) {
  const store = createSongLibraryStore({
    records: () => env.records,
    files: () => fake.files,
    newUuid: () => 'relaunched',
    openSong: () => env.openSong,
    fitTempo: () => fakeFitter(),
    now: () => Date.now(),
  });
  return { store, files: fake.files };
}

async function addSong(env: Env, uuid: string, filePath: string) {
  return env.records.insertSong({
    uuid,
    title: uuid,
    artist: '',
    filePath,
    durationSec: 1,
    format: 'mp3',
  });
}

async function killedDuringUndo(env: Env, uuid: string, filePath: string) {
  await env.records.deleteSongForUndo(await addSong(env, uuid, filePath));
}

describe('files of a song deleted with Undo', () => {
  it('are removed at the next start when the app died during Undo', async () => {
    const env = setup();
    const row = await importOne(env.store);
    await env.store.getState().deleteRowWithUndo(row);
    expect(env.files.deleteSongFolder).not.toHaveBeenCalled();
    const next = relaunch(env);
    await next.store.getState().start();
    expect(next.files.deleteSongFolder.mock.calls).toEqual([['f1']]);
    expect(await env.records.listHeldSongFiles()).toEqual([]);
    const after = relaunch(env);
    await after.store.getState().start();
    expect(after.files.deleteSongFolder).not.toHaveBeenCalled();
  });

  it('are never removed while a Library row still points at them', async () => {
    const env = setup();
    await killedDuringUndo(env, 'gone', 'songs/gone/Gone.mp3');
    await killedDuringUndo(env, 'shared', 'songs/shared/A.mp3');
    await addSong(env, 'restored', 'songs/shared/B.mp3');
    await killedDuringUndo(env, 'loose', 'music/Loose.mp3');
    await addSong(env, 'again', 'music/Loose.mp3');
    const next = relaunch(env);
    await next.store.getState().start();
    expect(next.files.deleteSongFolder.mock.calls).toEqual([['gone']]);
    expect(next.files.deleteLibraryFile).not.toHaveBeenCalled();
    expect(await env.records.listHeldSongFiles()).toEqual([]);
  });

  it('stay on disk while their Undo is still offered', async () => {
    const env = setup();
    const row = await importOne(env.store);
    await env.store.getState().deleteRowWithUndo(row);
    await env.store.getState().start();
    expect(env.files.deleteSongFolder).not.toHaveBeenCalled();
    await env.store.getState().undoDeleteSong();
    expect(env.store.getState().rows).toEqual([row]);
    expect(await env.records.listHeldSongFiles()).toEqual([]);
  });

  it('stay on disk when Undo is tapped while start reads the library', async () => {
    const env = setup();
    const row = await importOne(env.store);
    await env.store.getState().deleteRowWithUndo(row);
    const listHeld = env.records.listHeldSongFiles.bind(env.records);
    const listFiles = env.records.listSongFiles.bind(env.records);
    let heldRead = false;
    let tapped = false;
    let undoing = Promise.resolve();
    vi.spyOn(env.records, 'listHeldSongFiles').mockImplementation(async () => {
      const held = await listHeld();
      heldRead = true;
      return held;
    });
    vi.spyOn(env.records, 'listSongFiles').mockImplementation(async () => {
      const files = await listFiles();
      if (heldRead && !tapped) {
        tapped = true;
        undoing = env.store.getState().undoDeleteSong();
      }
      return files;
    });
    await env.store.getState().start();
    await undoing;
    expect(env.files.deleteSongFolder).not.toHaveBeenCalled();
    expect(env.store.getState().rows).toEqual([row]);
  });

  it('leave stem song folders alone', async () => {
    const env = setup();
    await env.store.getState().importStemFolder();
    await killedDuringUndo(env, 'gone', 'songs/gone/Gone.mp3');
    const next = relaunch(env);
    next.files.listStemFolders.mockResolvedValue([JOB_ID]);
    await next.store.getState().start();
    expect(next.files.deleteSongFolder.mock.calls).toEqual([['gone']]);
    expect(next.files.deleteStemFolder).not.toHaveBeenCalled();
    expect(next.files.deleteLibraryFile).not.toHaveBeenCalled();
  });

  it('are tried again at the next start when they could not be removed', async () => {
    const env = setup();
    await killedDuringUndo(env, 'gone', 'songs/gone/Gone.mp3');
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const next = relaunch(env);
    next.files.deleteSongFolder.mockRejectedValueOnce(new Error('busy'));
    await next.store.getState().start();
    expect(await env.records.listHeldSongFiles()).toHaveLength(1);
    const after = relaunch(env);
    await after.store.getState().start();
    expect(after.files.deleteSongFolder.mock.calls).toEqual([['gone']]);
    expect(await env.records.listHeldSongFiles()).toEqual([]);
  });

  it('are forgotten once Undo is dismissed and the folder is gone', async () => {
    const env = setup();
    const row = await importOne(env.store);
    await env.store.getState().deleteRowWithUndo(row);
    await env.store.getState().dismissDeletedSong();
    expect(env.files.deleteSongFolder.mock.calls).toEqual([['f1']]);
    expect(await env.records.listHeldSongFiles()).toEqual([]);
  });

  it('are not held when a song is deleted without Undo', async () => {
    const env = setup();
    const row = await importOne(env.store);
    await env.store.getState().deleteRow(row);
    expect(await env.records.listHeldSongFiles()).toEqual([]);
  });
});
