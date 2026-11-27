import type { ImportedAudio, PickedDocument } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import {
  badges,
  fakeFiles,
  MP3,
  setup,
  type Store,
  ZIP,
} from './store.test-helper.ts';

const WAV: PickedDocument = {
  uri: 'content://monkey-wrench',
  name: 'Monkey Wrench.wav',
  mimeType: 'audio/wav',
};

const M4A: PickedDocument = {
  uri: 'content://voice-memo',
  name: 'Voice memo.m4a',
  mimeType: 'audio/mp4',
};

const BROKEN: PickedDocument = {
  uri: 'content://broken',
  name: 'Broken.mp3',
  mimeType: 'audio/mpeg',
};

const TITLES: Readonly<Record<string, string>> = {
  [MP3.uri]: 'Everlong',
  [WAV.uri]: 'Monkey Wrench',
};

function copied(uri: string, dir: string): Promise<ImportedAudio> {
  if (uri === BROKEN.uri) return Promise.reject(new Error('E_IMPORT_FAILED'));
  const title = TITLES[uri] ?? uri;
  return Promise.resolve({
    relativePath: `${dir}/${title}.mp3`,
    title,
    artist: '',
    durationSec: 200,
  });
}

function picking(docs: readonly PickedDocument[]) {
  const fake = fakeFiles();
  vi.mocked(fake.files.pickDocuments).mockResolvedValue(docs);
  vi.mocked(fake.files.importAudio).mockImplementation(copied);
  return fake;
}

const kinds = (store: Store) =>
  store
    .getState()
    .rows.map((row) => [row.kind, row.title])
    .sort();

describe('importing several picked files', () => {
  it('imports every picked audio file as its own analyzing song', async () => {
    const { store, files } = setup(picking([MP3, WAV]));
    await store.getState().importSong();
    expect(vi.mocked(files.importAudio).mock.calls).toEqual([
      [MP3.uri, 'songs/f1'],
      [WAV.uri, 'songs/f2'],
    ]);
    expect(files.enqueueAnalysis).toHaveBeenCalledTimes(2);
    expect(badges(store).sort()).toEqual([
      ['Everlong', 'analyzing'],
      ['Monkey Wrench', 'analyzing'],
    ]);
    expect(store.getState().notice).toBeNull();
    expect(store.getState().importing).toEqual([]);
  });

  it('copies one file at a time', async () => {
    let copying = 0;
    let most = 0;
    const fake = picking([MP3, WAV, MP3]);
    vi.mocked(fake.files.importAudio).mockImplementation(
      async (uri: string, dir: string) => {
        copying += 1;
        most = Math.max(most, copying);
        await new Promise((resolve) => setTimeout(resolve, 0));
        copying -= 1;
        return copied(uri, dir);
      },
    );
    const { store, files } = setup(fake);
    await store.getState().importSong();
    expect(files.importAudio).toHaveBeenCalledTimes(3);
    expect(most).toBe(1);
  });

  it('sends a zip in a mixed selection through the stem bundle import', async () => {
    const { store, files } = setup(picking([MP3, ZIP]));
    await store.getState().importSong();
    expect(vi.mocked(files.importAudio).mock.calls).toEqual([
      [MP3.uri, 'songs/f1'],
    ]);
    expect(files.checkStemBundle).toHaveBeenCalledWith(ZIP.uri, false);
    expect(files.importStemBundle).toHaveBeenCalledWith(ZIP.uri, false);
    expect(kinds(store)).toEqual([
      ['song', 'Everlong'],
      ['stems', 'Redbone'],
    ]);
    expect(store.getState().notice).toEqual({
      kind: 'stemSongAdded',
      name: ZIP.name,
    });
  });

  it('waits for the replace answer before the next file', async () => {
    const { store, files } = setup(picking([ZIP]));
    await store.getState().importSong();
    vi.mocked(files.pickDocuments).mockResolvedValue([ZIP, WAV]);
    const running = store.getState().importSong();
    await vi.waitFor(() => {
      expect(store.getState().replacePrompt).not.toBeNull();
    });
    expect(files.importAudio).not.toHaveBeenCalled();
    await store.getState().confirmReplace();
    await running;
    expect(files.importStemBundle).toHaveBeenCalledTimes(2);
    expect(vi.mocked(files.importAudio).mock.calls).toEqual([
      [WAV.uri, 'songs/f3'],
    ]);
    expect(kinds(store)).toEqual([
      ['song', 'Monkey Wrench'],
      ['stems', 'Redbone'],
    ]);
  });

  it('goes on to the next file when a replace is cancelled', async () => {
    const { store, files } = setup(picking([ZIP]));
    await store.getState().importSong();
    vi.mocked(files.pickDocuments).mockResolvedValue([ZIP, WAV]);
    const running = store.getState().importSong();
    await vi.waitFor(() => {
      expect(store.getState().replacePrompt).not.toBeNull();
    });
    store.getState().cancelReplace();
    await running;
    expect(files.importStemBundle).toHaveBeenCalledOnce();
    expect(kinds(store)).toEqual([
      ['song', 'Monkey Wrench'],
      ['stems', 'Redbone'],
    ]);
  });

  it('keeps importing past failed files and names every one that failed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, files } = setup(picking([WAV]));
    await store.getState().importSong();
    const [existing] = store.getState().rows;
    vi.mocked(files.pickDocuments).mockResolvedValue([M4A, BROKEN, MP3]);
    await store.getState().importSong();
    expect(badges(store).sort()).toEqual([
      ['Everlong', 'analyzing'],
      ['Monkey Wrench', 'analyzing'],
    ]);
    expect(store.getState().rows).toContainEqual(existing);
    expect(store.getState().notice).toEqual({
      kind: 'importsFailed',
      names: [M4A.name, BROKEN.name],
    });
    expect(files.deleteSongFolder).not.toHaveBeenCalled();
    expect(store.getState().importing).toEqual([]);
  });

  it('shows the one failed file its own notice, over a later stem song added', async () => {
    const { store } = setup(picking([M4A, ZIP]));
    await store.getState().importSong();
    expect(kinds(store)).toEqual([['stems', 'Redbone']]);
    expect(store.getState().notice).toMatchObject({
      kind: 'formatRefused',
      name: M4A.name,
    });
  });

  it('does nothing when the picker returns no files', async () => {
    const { store, files } = setup(picking([]));
    await store.getState().importSong();
    expect(files.importAudio).not.toHaveBeenCalled();
    expect(files.checkStemBundle).not.toHaveBeenCalled();
    expect(store.getState().notice).toBeNull();
    expect(store.getState().rows).toEqual([]);
  });
});
