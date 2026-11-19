import { describe, expect, it, vi } from 'vitest';

import {
  CODES,
  fakeCamera,
  item,
  job,
  JOBS,
  ORIGIN,
  sent,
  SETLISTS,
  setup,
  snapshot,
  text,
} from './store.test-helper.ts';

const A = 'a'.repeat(12);
const B = 'b'.repeat(12);
const D = 'd'.repeat(12);
const LIBRARY_ID = 41;
const LIBRARY_SONG = { id: LIBRARY_ID, title: 'Gratitude' };

async function connected(owned: readonly string[] = [], jobs = JOBS) {
  const context = setup(owned, fakeCamera(), new Map([[B, LIBRARY_SONG]]));
  context.native.getJson.mockImplementation((_origin, endpoint) =>
    Promise.resolve(text(endpoint === CODES.endpointJobs ? jobs : SETLISTS)),
  );
  await context.store.getState().start();
  await context.store.getState().connect(ORIGIN);
  return context;
}

async function settledAdd(
  context: Awaited<ReturnType<typeof connected>>,
  jobId: string,
) {
  context.emit(
    snapshot([
      item(jobId, CODES.stateAdding, {
        fileUri: `file:/x/${jobId}`,
        ...sent(context.native, jobId),
      }),
    ]),
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
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: A, replace: CODES.replaceAdd }),
      expect.objectContaining({
        jobId: B,
        replace: CODES.replaceSet,
        replaceTarget: LIBRARY_ID,
      }),
    ]);
    await settledAdd(context, B);
    expect(context.addFetchedBundle).toHaveBeenLastCalledWith(
      expect.anything(),
      { kind: 'replaceSet', targetId: LIBRARY_ID },
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
      { kind: 'add' },
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

  it('skips only the matched songs, keeping new songs and earlier answers', async () => {
    const withFresh = JSON.stringify([
      ...(JSON.parse(JOBS) as object[]),
      job('d', 'Fresh'),
    ]);
    const context = await connected([A], withFresh);
    const { store, native } = context;
    store.getState().selectSongs([A, B, D]);
    await store.getState().importSelected();
    expect(await store.getState().replaceInLibrary()).toBe(false);
    expect(await store.getState().keepInLibrary()).toBe(true);
    expect(
      native.startImport.mock.calls[0]?.[1].map(({ jobId }) => jobId),
    ).toEqual([A, D]);
    await settledAdd(context, A);
    expect(context.addFetchedBundle).toHaveBeenLastCalledWith(
      expect.anything(),
      { kind: 'replaceJob' },
    );
    expect(store.getState().importView?.rows).toContainEqual(
      expect.objectContaining({ jobId: B, phase: 'skipped' }),
    );
  });

  it('clears the flag once the song is added', async () => {
    const context = await connected();
    await settledAdd(context, B);
    expect(
      context.store.getState().catalog?.songs.find((s) => s.jobId === B),
    ).toMatchObject({ inLibrary: true, sameSong: null });
  });
});
