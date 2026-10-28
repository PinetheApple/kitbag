import type { ImportedStemBundle, PickedDocument } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import {
  bundleCheck,
  CODES,
  fakeFiles,
  importedBundle,
  JOB_ID,
  setup,
  type Store,
} from './store.test-helper.ts';

const ZIP: PickedDocument = {
  uri: 'content://redbone.zip',
  name: 'Redbone.stemdeck.zip',
  mimeType: 'application/zip',
};

function zipFiles(overrides: Parameters<typeof fakeFiles>[0] = {}) {
  return fakeFiles({
    pickDocument: vi.fn(() => Promise.resolve<PickedDocument | null>(ZIP)),
    ...overrides,
  });
}

function rejection(code: string) {
  return Object.assign(new Error('refused'), { code });
}

async function stemRows(store: Store) {
  await store.getState().refresh();
  return store.getState().rows.filter((row) => row.kind === 'stems');
}

describe('StemDeck bundle import', () => {
  it('imports a zip: checks it, copies it and lists the stem song', async () => {
    const { store, files, records } = setup(zipFiles());
    await store.getState().importSong();
    expect(files.checkStemBundle).toHaveBeenCalledWith(ZIP.uri, false);
    expect(files.importStemBundle).toHaveBeenCalledWith(ZIP.uri, false);
    expect(files.importAudio).not.toHaveBeenCalled();
    const [row] = await stemRows(store);
    expect(row).toMatchObject({ title: 'Redbone', stemCount: 2 });
    expect(await records.readStemSet(row?.id ?? 0)).toMatchObject({
      jobId: JOB_ID,
      folder: `stems/${JOB_ID}`,
      sampleRate: 44100,
      stems: [
        expect.objectContaining({
          waveformPath: `stems/${JOB_ID}/vocals.kwav`,
        }),
        expect.objectContaining({ waveformPath: null, muted: true }),
      ],
    });
    expect(store.getState().notice).toBeNull();
    expect(store.getState().importing).toEqual([]);
  });

  it('imports an extracted folder as a folder', async () => {
    const { store, files } = setup();
    await store.getState().importStemFolder();
    expect(files.checkStemBundle).toHaveBeenCalledWith('content://tree', true);
    expect(files.importStemBundle).toHaveBeenCalledWith('content://tree', true);
    expect(await stemRows(store)).toHaveLength(1);
  });

  it('shows the bundle as importing while it is copied', async () => {
    let finish: (bundle: ImportedStemBundle) => void = () => undefined;
    const { store } = setup(
      zipFiles({
        importStemBundle: vi.fn(
          () =>
            new Promise<ImportedStemBundle>((resolve) => {
              finish = resolve;
            }),
        ),
      }),
    );
    const running = store.getState().importSong();
    await vi.waitFor(() => {
      expect(store.getState().importing).toEqual([ZIP.name]);
    });
    finish(importedBundle(`stems/${JOB_ID}`));
    await running;
    expect(store.getState().importing).toEqual([]);
  });

  it.each([
    [CODES.bundleRefusalNotABundle, 'notABundle'],
    [CODES.bundleRefusalVersion, 'version'],
    [CODES.bundleRefusalTooManyStems, 'tooManyStems'],
    [CODES.bundleRefusalNoSpace, 'noSpace'],
    [CODES.bundleRefusalUnreadable, 'unreadable'],
    ['a code native does not promise', 'unreadable'],
  ])('refuses a %s bundle as %s, copying nothing', async (code, reason) => {
    const check = bundleCheck({ refusal: code, version: 2, stemCount: 18 });
    const fake = zipFiles();
    fake.files.checkStemBundle.mockResolvedValue(check);
    const { store, files } = setup(fake);
    await store.getState().importSong();
    expect(store.getState().notice).toEqual({
      kind: 'bundleRefused',
      name: ZIP.name,
      refusal: { reason, version: 2, stemCount: 18, maxStems: 16 },
    });
    expect(files.importStemBundle).not.toHaveBeenCalled();
    expect(await stemRows(store)).toEqual([]);
  });

  it('reads a check that could not read the file as unreadable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = zipFiles();
    fake.files.checkStemBundle.mockRejectedValue(rejection('E_IMPORT_FAILED'));
    const { store } = setup(fake);
    await store.getState().importSong();
    expect(store.getState().notice).toMatchObject({
      kind: 'bundleRefused',
      refusal: { reason: 'unreadable' },
    });
    expect(store.getState().importing).toEqual([]);
  });

  it('maps a refusal from the copy itself to the same notice', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store } = setup(
      zipFiles({
        importStemBundle: vi.fn(() =>
          Promise.reject(rejection(CODES.bundleRefusalNoSpace)),
        ),
      }),
    );
    await store.getState().importSong();
    expect(store.getState().notice).toMatchObject({
      kind: 'bundleRefused',
      refusal: { reason: 'noSpace', stemCount: 2, maxStems: 16 },
    });
  });

  it('reports any other copy failure as a failed copy', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store } = setup(
      zipFiles({
        importStemBundle: vi.fn(() =>
          Promise.reject(rejection('E_IMPORT_FAILED')),
        ),
      }),
    );
    await store.getState().importSong();
    expect(store.getState().notice).toEqual({
      kind: 'copyFailed',
      name: ZIP.name,
    });
    expect(await stemRows(store)).toEqual([]);
  });

  it('deletes the copied folder when the database refuses the set', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, records, files } = setup(zipFiles());
    vi.spyOn(records, 'insertStemBundle').mockRejectedValue(new Error('db'));
    await store.getState().importSong();
    expect(store.getState().notice).toEqual({
      kind: 'addFailed',
      name: ZIP.name,
    });
    expect(files.deleteStemFolder.mock.calls).toEqual([[JOB_ID]]);
  });

  it('asks before replacing the same StemDeck song, naming it', async () => {
    const { store, files } = setup(zipFiles());
    await store.getState().importSong();
    await store.getState().importSong();
    expect(store.getState().replacePrompt).toEqual({
      name: ZIP.name,
      title: 'Redbone',
    });
    expect(files.importStemBundle).toHaveBeenCalledTimes(1);
    store.getState().cancelReplace();
    expect(store.getState().replacePrompt).toBeNull();
    await store.getState().confirmReplace();
    expect(files.importStemBundle).toHaveBeenCalledTimes(1);
  });

  it('replaces on confirm, then deletes the old folder', async () => {
    const { store, files, records } = setup(zipFiles());
    await store.getState().importSong();
    const [old] = await stemRows(store);
    await store.getState().importSong();
    await store.getState().confirmReplace();
    expect(store.getState().replacePrompt).toBeNull();
    const rows = await stemRows(store);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).not.toBe(old?.id);
    expect(await records.readStemSet(rows[0]?.id ?? 0)).toMatchObject({
      folder: `stems/${JOB_ID}-2`,
    });
    expect(files.deleteStemFolder.mock.calls).toEqual([[JOB_ID]]);
    expect(files.deleteLibraryFile).not.toHaveBeenCalled();
  });

  it('deletes a StemDeck song with its whole folder', async () => {
    const { store, files } = setup(zipFiles());
    await store.getState().importSong();
    const [row] = await stemRows(store);
    if (row === undefined) throw new Error('no row');
    await store.getState().deleteRow(row);
    expect(files.deleteStemFolder.mock.calls).toEqual([[JOB_ID]]);
    expect(files.deleteLibraryFile).not.toHaveBeenCalled();
    expect(store.getState().rows).toEqual([]);
  });

  it('copies nothing without the native library constants', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fake = zipFiles();
    fake.files.constants.mockImplementation(() => {
      throw new Error('no native module');
    });
    const { store, files } = setup(fake);
    await store.getState().importSong();
    expect(files.checkStemBundle).not.toHaveBeenCalled();
    expect(store.getState().notice).toEqual({
      kind: 'copyFailed',
      name: ZIP.name,
    });
  });
});
