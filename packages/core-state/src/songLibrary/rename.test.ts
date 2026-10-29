import { describe, expect, it, vi } from 'vitest';

import { importedBundle, importOne, setup } from './store.test-helper.ts';
import { newStemBundle } from './stemBundleLogic.ts';

describe('renaming a library row', () => {
  it('renames a song and shows the trimmed name', async () => {
    const { store } = setup();
    const row = await importOne(store);
    await store.getState().renameRow(row, '  Everlong (acoustic) ');
    expect(store.getState().rows).toEqual([
      expect.objectContaining({
        title: 'Everlong (acoustic)',
        artist: 'Foo Fighters',
      }),
    ]);
  });

  it('refuses a blank name and changes nothing', async () => {
    const { store, records } = setup();
    const row = await importOne(store);
    const rename = vi.spyOn(records, 'renameSong');
    await store.getState().renameRow(row, '   ');
    expect(rename).not.toHaveBeenCalled();
    expect(store.getState().rows[0]).toMatchObject({ title: 'Everlong' });
  });

  it('renames a stem song', async () => {
    const { store, records } = setup();
    await records.insertStemBundle(
      newStemBundle(importedBundle('stems/job'), 'u'),
    );
    await store.getState().refresh();
    const [row] = store.getState().rows;
    if (row === undefined) throw new Error('no row');
    await store.getState().renameRow(row, 'Redbone (live)');
    expect(store.getState().rows).toEqual([
      expect.objectContaining({ kind: 'stems', title: 'Redbone (live)' }),
    ]);
  });

  it('leaves an unchanged stem song name unwritten so re-imports keep its title', async () => {
    const { store, records } = setup();
    await records.insertStemBundle(
      newStemBundle(importedBundle('stems/job'), 'u'),
    );
    await store.getState().refresh();
    const [row] = store.getState().rows;
    if (row === undefined) throw new Error('no row');
    const rename = vi.spyOn(records, 'renameStemSet');
    await store.getState().renameRow(row, ` ${row.title}  `);
    expect(rename).not.toHaveBeenCalled();
  });

  it('says so when the name could not be stored', async () => {
    const { store, records } = setup();
    const row = await importOne(store);
    vi.spyOn(records, 'renameSong').mockRejectedValueOnce(new Error('locked'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await store.getState().renameRow(row, 'Everlong (live)');
    expect(store.getState().notice).toEqual({
      kind: 'renameFailed',
      name: 'Everlong',
    });
    expect(store.getState().rows[0]).toMatchObject({ title: 'Everlong' });
  });
});
