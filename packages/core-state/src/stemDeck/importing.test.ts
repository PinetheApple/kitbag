import type { StemDeckImportItem } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { ReplaceChoice } from '../songLibrary/stemBundleLogic.ts';
import {
  CODES,
  item,
  ORIGIN,
  rejection,
  sent,
  setup,
  snapshot,
} from './store.test-helper.ts';

const A = 'a'.repeat(12);
const B = 'b'.repeat(12);
const C = 'c'.repeat(12);
const TARGET = 7;

interface Interrupted {
  readonly jobId: string;
  readonly state: string;
  readonly replace: Partial<StemDeckImportItem>;
  readonly choice: ReplaceChoice;
}

const INTERRUPTED: readonly Interrupted[] = [
  {
    jobId: A,
    state: CODES.stateFailed,
    replace: { replace: CODES.replaceSet, replaceTarget: TARGET },
    choice: { kind: 'replaceSet', targetId: TARGET },
  },
  {
    jobId: B,
    state: CODES.stateNotStarted,
    replace: { replace: CODES.replaceJob },
    choice: { kind: 'replaceJob' },
  },
  {
    jobId: C,
    state: CODES.stateNotStarted,
    replace: {},
    choice: { kind: 'add' },
  },
];

describe('picking and importing', () => {
  async function connected(owned: readonly string[] = []) {
    const context = setup(owned);
    await context.store.getState().start();
    await context.store.getState().connect(ORIGIN);
    return context;
  }

  it('sends the picked songs with their lanes and clears the selection', async () => {
    const { store, native } = await connected();
    store.getState().selectSongs([B]);
    await store.getState().importSelected();
    expect(native.startImport).toHaveBeenCalledWith(ORIGIN, [
      {
        jobId: B,
        title: 'Gratitude',
        stems: ['vocals', 'drums', 'bass'],
        replace: CODES.replaceAdd,
        replaceTarget: null,
      },
    ]);
    expect(store.getState().selected).toEqual([]);
  });

  it('asks before replacing songs already in the library', async () => {
    const { store, native, emit, addFetchedBundle } = await connected([A]);
    store.getState().selectSongs([A, B]);
    await store.getState().importSelected();
    expect(store.getState().replacePrompt).toEqual({
      match: 'job',
      titles: ['Way Maker'],
    });
    expect(native.startImport).not.toHaveBeenCalled();
    await store.getState().replaceInLibrary();
    expect(native.startImport.mock.calls[0]?.[1]).toHaveLength(2);
    emit(
      snapshot([
        item(A, CODES.stateAdding, {
          fileUri: 'file:/x/a.zip',
          ...sent(native, A),
        }),
      ]),
    );
    await vi.waitFor(() => {
      expect(native.settleDownload).toHaveBeenCalledWith(A, CODES.settleAdded);
    });
    expect(addFetchedBundle).toHaveBeenCalledWith(
      expect.objectContaining({ uri: 'file:/x/a.zip' }),
      { kind: 'replaceJob' },
    );
  });

  it('says whether songs were sent, so only a real start asks for notifications', async () => {
    const { store, native } = await connected([A]);
    store.getState().selectSongs([A]);
    expect(await store.getState().importSelected()).toBe(false);
    expect(await store.getState().keepInLibrary()).toBe(false);
    store.getState().selectSongs([B]);
    expect(await store.getState().importSelected()).toBe(true);
    native.startImport.mockRejectedValueOnce(
      rejection(CODES.failureBadAddress),
    );
    store.getState().selectSongs([B]);
    expect(await store.getState().importSelected()).toBe(false);
  });

  it('keeps the library copy and shows the song as skipped', async () => {
    const { store, native, emit } = await connected([A]);
    store.getState().selectSongs([A, B]);
    await store.getState().importSelected();
    await store.getState().keepInLibrary();
    expect(native.startImport.mock.calls[0]?.[1]).toEqual([
      expect.objectContaining({ jobId: B }),
    ]);
    emit(snapshot([item(B, CODES.statePreparing)]));
    expect(
      store.getState().importView?.rows.map((r) => [r.jobId, r.phase]),
    ).toEqual([
      [A, 'skipped'],
      [B, 'preparing'],
    ]);
  });

  it('marks a song added from StemDeck as in the library', async () => {
    const { store, emit, native } = await connected();
    emit(snapshot([item(B, CODES.stateAdding, { fileUri: 'file:/x/b.zip' })]));
    await vi.waitFor(() => {
      expect(native.settleDownload).toHaveBeenCalled();
    });
    expect(
      store.getState().catalog?.songs.find((s) => s.jobId === B)?.inLibrary,
    ).toBe(true);
  });

  it('retries an interrupted import after a reload with the replace each song was sent with', async () => {
    const context = setup();
    context.native.importSnapshot.mockResolvedValue(
      snapshot(
        INTERRUPTED.map(({ jobId, state, replace }) =>
          item(jobId, state, { failure: CODES.failureInterrupted, ...replace }),
        ),
        { running: false, stopReason: CODES.failureInterrupted },
      ),
    );
    await context.store.getState().start();
    await context.store.getState().retryImport();
    context.emit(
      snapshot(
        INTERRUPTED.map(({ jobId, replace }) =>
          item(jobId, CODES.stateAdding, {
            fileUri: `file:/x/${jobId}.zip`,
            ...replace,
          }),
        ),
      ),
    );
    await vi.waitFor(() => {
      expect(context.native.settleDownload).toHaveBeenCalledTimes(3);
    });
    expect(context.addFetchedBundle.mock.calls.map((call) => call[1])).toEqual(
      INTERRUPTED.map(({ choice }) => choice),
    );
  });

  it('settles a download left over from before a reload', async () => {
    const context = setup();
    context.native.importSnapshot.mockResolvedValue(
      snapshot([item(A, CODES.stateAdding, { fileUri: 'file:/x/a.zip' })]),
    );
    await context.store.getState().start();
    await vi.waitFor(() => {
      expect(context.native.settleDownload).toHaveBeenCalledWith(
        A,
        CODES.settleAdded,
      );
    });
  });

  it('starts listening once', async () => {
    const { store, native } = setup();
    const stop = await store.getState().start();
    expect(await store.getState().start()).toBe(stop);
    expect(native.onImport).toHaveBeenCalledTimes(1);
    stop();
    await store.getState().start();
    expect(native.onImport).toHaveBeenCalledTimes(2);
  });

  it('passes cancel, retry and watching through', async () => {
    const { store, native } = setup();
    store.getState().cancelImport();
    await store.getState().retryImport();
    store.getState().setWatching(false);
    expect(native.cancelImport).toHaveBeenCalled();
    expect(native.retryImport).toHaveBeenCalled();
    expect(native.setWatching).toHaveBeenCalledWith(false);
  });

  it('shows the unity mix note until it has been seen once', async () => {
    const { store, unityNotice } = await connected();
    expect(store.getState().unityNoticeSeen).toBe(false);
    store.getState().markUnityNoticeSeen();
    store.getState().markUnityNoticeSeen();
    expect(unityNotice.save).toHaveBeenCalledTimes(1);
    expect(store.getState().unityNoticeSeen).toBe(true);
  });
});
