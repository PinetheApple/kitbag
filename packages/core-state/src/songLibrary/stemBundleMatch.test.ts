import type { ImportedStemBundle, PickedDocument } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import {
  bundleCheck,
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
  unsupportedHeaderFormat: '',
};

const RESEPARATED = 'reseparated-job';

const FETCHED = {
  uri: 'file:/fetched.zip',
  name: 'Redbone',
  isFolder: false,
};

function reseparatedFiles() {
  const importStemBundle = vi
    .fn<() => Promise<ImportedStemBundle>>()
    .mockResolvedValueOnce(importedBundle(`stems/${JOB_ID}`))
    .mockResolvedValue({
      ...importedBundle(`stems/${RESEPARATED}`),
      jobId: RESEPARATED,
    });
  const fake = fakeFiles({
    pickDocument: vi.fn(() => Promise.resolve<PickedDocument | null>(ZIP)),
    importStemBundle,
  });
  fake.files.checkStemBundle
    .mockResolvedValueOnce(bundleCheck())
    .mockResolvedValue(bundleCheck({ jobId: RESEPARATED }));
  return fake;
}

async function stemRows(store: Store) {
  await store.getState().refresh();
  return store.getState().rows.filter((row) => row.kind === 'stems');
}

async function importTwice() {
  const context = setup(reseparatedFiles());
  await context.store.getState().importSong();
  const [first] = await stemRows(context.store);
  if (first === undefined) throw new Error('setup');
  await context.store.getState().importSong();
  return { ...context, first };
}

describe('importing a song StemDeck separated again', () => {
  it('offers to replace the matching song or keep both, before copying', async () => {
    const { store, files } = await importTwice();
    expect(store.getState().replacePrompt).toEqual({
      name: ZIP.name,
      title: 'Redbone',
      match: 'song',
    });
    expect(files.importStemBundle).toHaveBeenCalledTimes(1);
  });

  it('replaces the matched song with the new job and deletes the old folder', async () => {
    const { store, files, records, first } = await importTwice();
    await store.getState().confirmReplace();
    const rows = await stemRows(store);
    expect(rows).toHaveLength(1);
    expect(await records.readStemSet(first.id)).toBeUndefined();
    expect(await records.readStemSet(rows[0]?.id ?? 0)).toMatchObject({
      jobId: RESEPARATED,
    });
    expect(files.deleteStemFolder.mock.calls).toEqual([[JOB_ID]]);
  });

  it('keeps both as two songs when asked', async () => {
    const { store, files, records, first } = await importTwice();
    await store.getState().keepBoth();
    expect(store.getState().replacePrompt).toBeNull();
    expect(await stemRows(store)).toHaveLength(2);
    expect(await records.readStemSet(first.id)).toMatchObject({
      jobId: JOB_ID,
    });
    expect(files.deleteStemFolder).not.toHaveBeenCalled();
  });

  it('adds nothing on cancel', async () => {
    const { store, files } = await importTwice();
    store.getState().cancelReplace();
    expect(store.getState().replacePrompt).toBeNull();
    await store.getState().keepBoth();
    expect(await stemRows(store)).toHaveLength(1);
    expect(files.importStemBundle).toHaveBeenCalledTimes(1);
  });

  it('adds the song with no prompt when nothing matches it', async () => {
    const fake = reseparatedFiles();
    fake.files.checkStemBundle
      .mockReset()
      .mockResolvedValueOnce(bundleCheck())
      .mockResolvedValue(
        bundleCheck({ jobId: RESEPARATED, title: 'Redbone (demo)' }),
      );
    const { store } = setup(fake);
    await store.getState().importSong();
    await store.getState().importSong();
    expect(store.getState().replacePrompt).toBeNull();
    expect(await stemRows(store)).toHaveLength(2);
  });

  it('adds the song when the match lookup fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { store, records } = setup(reseparatedFiles());
    await store.getState().importSong();
    vi.spyOn(records, 'findStemSetMatches').mockRejectedValue(new Error('db'));
    await store.getState().importSong();
    expect(store.getState().replacePrompt).toBeNull();
    expect(await stemRows(store)).toHaveLength(2);
  });

  it('adds a fetched bundle without matching by song, since nobody is asked', async () => {
    const { store } = setup(reseparatedFiles());
    await store.getState().addFetchedBundle(FETCHED, { kind: 'replaceJob' });
    const outcome = await store
      .getState()
      .addFetchedBundle(FETCHED, { kind: 'replaceJob' });
    expect(outcome).toEqual({ kind: 'added' });
    expect(await stemRows(store)).toHaveLength(2);
  });

  it('replaces the song a fetch names as its target', async () => {
    const { store, records, files } = setup(reseparatedFiles());
    await store.getState().addFetchedBundle(FETCHED, { kind: 'add' });
    const [first] = await stemRows(store);
    if (first === undefined) throw new Error('setup');
    const outcome = await store
      .getState()
      .addFetchedBundle(FETCHED, { kind: 'replaceSet', targetId: first.id });
    expect(outcome).toEqual({ kind: 'added' });
    const rows = await stemRows(store);
    expect(rows).toHaveLength(1);
    expect(await records.readStemSet(rows[0]?.id ?? 0)).toMatchObject({
      jobId: RESEPARATED,
    });
    expect(files.deleteStemFolder.mock.calls).toEqual([[JOB_ID]]);
  });
});
