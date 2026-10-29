import { describe, expect, it, vi } from 'vitest';

import { opened, stem } from './store.test-helper.ts';

const names = (store: Awaited<ReturnType<typeof opened>>['store']) =>
  store.getState().stems.map((row) => row.name);

describe('renaming a stem', () => {
  it('shows and stores the trimmed name for that stem only', async () => {
    const { records, store } = await opened([stem(1), stem(2)]);
    await store.getState().renameStem(1, '  Keys ');
    expect(names(store)).toEqual(['stem-1', 'Keys']);
    expect(records.renameStem).toHaveBeenCalledWith(2, 'Keys');
  });

  it('keeps the old name for a blank or unchanged one', async () => {
    const { records, store } = await opened([stem(1)]);
    await store.getState().renameStem(0, '   ');
    await store.getState().renameStem(0, 'stem-1');
    expect(names(store)).toEqual(['stem-1']);
    expect(records.renameStem).not.toHaveBeenCalled();
  });

  it('goes back to the old name when it could not be stored', async () => {
    const { records, store } = await opened([stem(1)]);
    records.renameStem.mockRejectedValueOnce(new Error('locked'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await store.getState().renameStem(0, 'Keys');
    expect(names(store)).toEqual(['stem-1']);
  });
});
