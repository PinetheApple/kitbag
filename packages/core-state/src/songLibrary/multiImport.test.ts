import type { ImportedAudio, PickedDocument } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { LibraryFiles } from './runtime.ts';
import {
  badges,
  bundleCheck,
  fakeFiles,
  importedBundle,
  JOB_ID,
  MP3,
  settle,
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

const RESEPARATED: PickedDocument = {
  uri: 'content://redbone-reseparated.zip',
  name: 'Redbone reseparated.stemdeck.zip',
  mimeType: 'application/zip',
};

const REMASTERED: PickedDocument = {
  uri: 'content://redbone-remastered.zip',
  name: 'Redbone remastered.stemdeck.zip',
  mimeType: 'application/zip',
};

const JOB_IDS: Readonly<Record<string, string>> = {
  [ZIP.uri]: JOB_ID,
  [RESEPARATED.uri]: 'reseparated-job',
  [REMASTERED.uri]: 'remastered-job',
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

function jobOf(uri: string): string {
  return JOB_IDS[uri] ?? JOB_ID;
}

function picking(
  docs: readonly PickedDocument[],
  overrides: Parameters<typeof fakeFiles>[0] = {},
) {
  const fake = fakeFiles(overrides);
  vi.mocked(fake.files.pickDocuments).mockResolvedValue(docs);
  vi.mocked(fake.files.importAudio).mockImplementation(copied);
  return fake;
}

function separatedAgain(docs: readonly PickedDocument[]) {
  const fake = picking(docs, {
    importStemBundle: vi.fn<LibraryFiles['importStemBundle']>((uri) =>
      Promise.resolve({
        ...importedBundle(`stems/${jobOf(uri)}`),
        jobId: jobOf(uri),
      }),
    ),
  });
  fake.files.checkStemBundle.mockImplementation((uri) =>
    Promise.resolve(bundleCheck({ jobId: jobOf(uri) })),
  );
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

  it('imports both when a replace is answered with keep both', async () => {
    const { store, files } = setup(separatedAgain([ZIP]));
    await store.getState().importSong();
    vi.mocked(files.pickDocuments).mockResolvedValue([RESEPARATED, WAV]);
    const running = store.getState().importSong();
    await vi.waitFor(() => {
      expect(store.getState().replacePrompt).not.toBeNull();
    });
    expect(files.importAudio).not.toHaveBeenCalled();
    await store.getState().keepBoth();
    await running;
    expect(kinds(store)).toEqual([
      ['song', 'Monkey Wrench'],
      ['stems', 'Redbone'],
      ['stems', 'Redbone'],
    ]);
  });

  it('opens the second replace prompt only after the first is answered', async () => {
    const { store, files } = setup(separatedAgain([ZIP]));
    await store.getState().importSong();
    vi.mocked(files.pickDocuments).mockResolvedValue([RESEPARATED, REMASTERED]);
    const running = store.getState().importSong();
    await vi.waitFor(() => {
      expect(store.getState().replacePrompt?.name).toBe(RESEPARATED.name);
    });
    await settle();
    expect(store.getState().replacePrompt?.name).toBe(RESEPARATED.name);
    expect(files.checkStemBundle).toHaveBeenCalledTimes(2);
    await store.getState().keepBoth();
    await vi.waitFor(() => {
      expect(store.getState().replacePrompt?.name).toBe(REMASTERED.name);
    });
    await store.getState().confirmReplace();
    await running;
    expect(files.importStemBundle).toHaveBeenCalledTimes(3);
    expect(kinds(store)).toEqual([
      ['stems', 'Redbone'],
      ['stems', 'Redbone'],
    ]);
  });

  it('ignores a second import while a batch is still running', async () => {
    const { store, files } = setup(picking([ZIP]));
    await store.getState().importSong();
    vi.mocked(files.pickDocuments).mockResolvedValue([ZIP, WAV]);
    const running = store.getState().importSong();
    await vi.waitFor(() => {
      expect(store.getState().replacePrompt).not.toBeNull();
    });
    await store.getState().importSong();
    expect(files.pickDocuments).toHaveBeenCalledTimes(2);
    expect(store.getState().replacePrompt?.name).toBe(ZIP.name);
    store.getState().cancelReplace();
    await running;
    expect(vi.mocked(files.importAudio).mock.calls).toEqual([
      [WAV.uri, 'songs/f2'],
    ]);
  });

  it('does not wait on a replace prompt left open by an earlier import', async () => {
    const { store, files } = setup(picking([ZIP]));
    await store.getState().importSong();
    await store.getState().importSong();
    expect(store.getState().replacePrompt?.name).toBe(ZIP.name);
    vi.mocked(files.pickDocuments).mockResolvedValue([MP3, WAV]);
    await store.getState().importSong();
    expect(badges(store).sort()).toEqual([
      ['Everlong', 'analyzing'],
      ['Monkey Wrench', 'analyzing'],
      ['Redbone'],
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

  it('imports opened or shared files without opening the picker', async () => {
    const { store, files } = setup(picking([]));
    await store.getState().importDocuments([MP3, ZIP]);
    expect(files.pickDocuments).not.toHaveBeenCalled();
    expect(vi.mocked(files.importAudio).mock.calls).toEqual([
      [MP3.uri, 'songs/f1'],
    ]);
    expect(files.importStemBundle).toHaveBeenCalledWith(ZIP.uri, false);
    expect(kinds(store)).toEqual([
      ['song', 'Everlong'],
      ['stems', 'Redbone'],
    ]);
  });

  it('refuses a shared file of an unsupported type with the format notice and keeps the library as it was', async () => {
    const { store, files } = setup(picking([WAV]));
    await store.getState().importSong();
    const before = store.getState().rows;
    await store.getState().importDocuments([M4A]);
    expect(store.getState().rows).toEqual(before);
    expect(files.importAudio).toHaveBeenCalledOnce();
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
