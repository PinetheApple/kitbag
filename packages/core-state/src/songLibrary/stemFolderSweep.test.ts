import type { ImportedStemBundle } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import {
  fakeFiles,
  importedBundle,
  JOB_ID,
  setup,
} from './store.test-helper.ts';

describe('orphaned stem folder sweep', () => {
  it('deletes only the folders no stem set refers to', async () => {
    const { store, files } = setup();
    await store.getState().importStemFolder();
    files.listStemFolders.mockResolvedValue([JOB_ID, 'killed-import', 'old']);
    await store.getState().start();
    expect(files.deleteStemFolder.mock.calls).toEqual([
      ['killed-import'],
      ['old'],
    ]);
  });

  it('keeps a folder whose copy is still in flight', async () => {
    let finish: (bundle: ImportedStemBundle) => void = () => undefined;
    const fake = fakeFiles({
      importStemBundle: vi.fn(
        () =>
          new Promise<ImportedStemBundle>((resolve) => {
            finish = resolve;
          }),
      ),
    });
    const { store, files } = setup(fake);
    files.listStemFolders.mockResolvedValue([JOB_ID]);
    const importing = store.getState().importStemFolder();
    await vi.waitFor(() => {
      expect(files.importStemBundle).toHaveBeenCalled();
    });
    await store.getState().start();
    finish(importedBundle(`stems/${JOB_ID}`));
    await importing;
    expect(files.deleteStemFolder).not.toHaveBeenCalled();
  });

  it('keeps a copied folder whose row is not written yet', async () => {
    const { store, files, records } = setup();
    let write: () => void = () => undefined;
    const insert = records.insertStemBundle.bind(records);
    vi.spyOn(records, 'insertStemBundle').mockImplementation(
      (bundle) =>
        new Promise((resolve, reject) => {
          write = () => {
            insert(bundle).then(resolve, reject);
          };
        }),
    );
    files.listStemFolders.mockResolvedValue([JOB_ID]);
    const importing = store.getState().importStemFolder();
    await vi.waitFor(() => {
      expect(records.insertStemBundle).toHaveBeenCalled();
    });
    await store.getState().start();
    write();
    await importing;
    expect(files.deleteStemFolder).not.toHaveBeenCalled();
  });

  it('deletes nothing when an import finishes between its reads', async () => {
    const { store, files, records } = setup();
    const list = records.listStemSetFolders.bind(records);
    vi.spyOn(records, 'listStemSetFolders').mockImplementation(async () => {
      const folders = await list();
      await store.getState().importStemFolder();
      return folders;
    });
    files.listStemFolders.mockResolvedValue([JOB_ID]);
    await store.getState().start();
    expect(await list()).toEqual([`stems/${JOB_ID}`]);
    expect(files.deleteStemFolder).not.toHaveBeenCalled();
  });
});
