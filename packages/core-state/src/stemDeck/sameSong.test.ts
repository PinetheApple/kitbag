import { describe, expect, it, vi } from 'vitest';

import {
  CODES,
  fakeCamera,
  item,
  ORIGIN,
  setup,
  snapshot,
} from './store.test-helper.ts';

const A = 'a'.repeat(12);
const B = 'b'.repeat(12);
const LIBRARY_ID = 41;
const LIBRARY_SONG = { id: LIBRARY_ID, title: 'Gratitude' };

async function connected(owned: readonly string[] = []) {
  const context = setup(owned, fakeCamera(), new Map([[B, LIBRARY_SONG]]));
  await context.store.getState().start();
  await context.store.getState().connect(ORIGIN);
  return context;
}

async function settledAdd(
  context: Awaited<ReturnType<typeof connected>>,
  jobId: string,
) {
  context.emit(
    snapshot([item(jobId, CODES.stateAdding, { fileUri: `file:/x/${jobId}` })]),
  );
  await vi.waitFor(() => {
    expect(context.native.settleDownload).toHaveBeenCalled();
  });
}

describe('a StemDeck song separated again', () => {
  it('is flagged with the library song it matches, while IN LIBRARY stays by job', async () => {
    const { store } = await connected();
    expect(
      store
        .getState()
        .catalog?.songs.map((s) => [s.jobId, s.inLibrary, s.sameSong]),
    ).toEqual([
      [A, false, null],
      [B, false, LIBRARY_SONG],
    ]);
  });

  it('is not looked up for a song already in the library by job', async () => {
    const { store } = await connected([B]);
    expect(
      store.getState().catalog?.songs.find((s) => s.jobId === B)?.sameSong,
    ).toBeNull();
  });

  it('asks before downloading, and Replace names the library song as the target', async () => {
    const context = await connected();
    const { store, native } = context;
    store.getState().selectSongs([A, B]);
    expect(await store.getState().importSelected()).toBe(false);
    expect(store.getState().replacePrompt).toEqual({
      match: 'song',
      titles: ['Gratitude'],
    });
    expect(native.startImport).not.toHaveBeenCalled();
    expect(await store.getState().replaceInLibrary()).toBe(true);
    expect(native.startImport.mock.calls[0]?.[1]).toHaveLength(2);
    await settledAdd(context, B);
    expect(context.addFetchedBundle).toHaveBeenLastCalledWith(
      expect.anything(),
      { replace: true, targetId: LIBRARY_ID },
    );
  });

  it('keeps both by downloading it as a new song', async () => {
    const context = await connected();
    const { store, native } = context;
    store.getState().selectSongs([B]);
    await store.getState().importSelected();
    expect(await store.getState().keepBoth()).toBe(true);
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: B }),
    ]);
    await settledAdd(context, B);
    expect(context.addFetchedBundle).toHaveBeenLastCalledWith(
      expect.anything(),
      { replace: false },
    );
  });

  it('downloads nothing on cancel', async () => {
    const { store, native } = await connected();
    store.getState().selectSongs([B]);
    await store.getState().importSelected();
    store.getState().dismissReplace();
    expect(store.getState().replacePrompt).toBeNull();
    expect(await store.getState().keepBoth()).toBe(false);
    expect(native.startImport).not.toHaveBeenCalled();
  });

  it('asks about the IN LIBRARY songs first, then the matched ones', async () => {
    const { store, native } = await connected([A]);
    store.getState().selectSongs([A, B]);
    await store.getState().importSelected();
    expect(store.getState().replacePrompt).toEqual({
      match: 'job',
      titles: ['Way Maker'],
    });
    expect(await store.getState().keepInLibrary()).toBe(false);
    expect(store.getState().replacePrompt).toEqual({
      match: 'song',
      titles: ['Gratitude'],
    });
    expect(native.startImport).not.toHaveBeenCalled();
    expect(await store.getState().keepBoth()).toBe(true);
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: B }),
    ]);
  });

  it('clears the flag once the song is added', async () => {
    const context = await connected();
    await settledAdd(context, B);
    expect(
      context.store.getState().catalog?.songs.find((s) => s.jobId === B),
    ).toMatchObject({ inLibrary: true, sameSong: null });
  });
});
