import type { DataFolderVolume } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { DATA_FOLDER_CODES as CODES } from './codes.test-helper.ts';
import { returnedCards } from './store.ts';
import { CARD, VOLUMES, setupStore, status } from './store.test-helper.ts';

const INTERNAL: DataFolderVolume = {
  volumeUuid: null,
  name: null,
  state: CODES.volumeStates.mounted,
  inUse: true,
  freeBytes: 5_000,
  totalBytes: 9_000,
  awayFiles: 0,
  awayBytes: 0,
};

function card(fields: Partial<DataFolderVolume> = {}): DataFolderVolume {
  return {
    volumeUuid: CARD,
    name: 'SanDisk SD card',
    state: CODES.volumeStates.mounted,
    inUse: false,
    freeBytes: 2_000,
    totalBytes: 4_000,
    awayFiles: 6,
    awayBytes: 1_200,
    ...fields,
  };
}

async function started(volumes: readonly DataFolderVolume[]) {
  const harness = setupStore();
  harness.native.listVolumes.mockResolvedValue({ ...VOLUMES, volumes });
  await harness.store.getState().start();
  return harness;
}

describe('returned cards', () => {
  it('lists a mounted card that holds away songs', async () => {
    const returned = card();
    const { store } = await started([INTERNAL, returned]);
    expect(returnedCards(store.getState())).toEqual([returned]);
  });

  it('lists no card that is missing, holds nothing away, or is in use', async () => {
    const { store } = await started([
      INTERNAL,
      card({ state: CODES.volumeStates.unmounted, awayFiles: 0 }),
      card({ volumeUuid: 'EMPTY', awayFiles: 0, awayBytes: 0 }),
      card({ volumeUuid: 'IN-USE', inUse: true }),
    ]);
    expect(returnedCards(store.getState())).toEqual([]);
  });

  it('lists none while another move runs or waits', async () => {
    const { store, progress } = await started([INTERNAL, card()]);
    progress(status());
    expect(returnedCards(store.getState())).toEqual([]);
    progress(status({ running: false, paused: true }));
    expect(returnedCards(store.getState())).toEqual([]);
  });

  it('lists none while a request is pending', async () => {
    const { store } = await started([INTERNAL, card()]);
    const resuming = store.getState().resumeMove();
    expect(returnedCards(store.getState())).toEqual([]);
    await resuming;
  });
});

describe('returning a card', () => {
  it('starts the move from the returned card', async () => {
    const { store, native } = await started([INTERNAL, card()]);
    await expect(store.getState().returnCard(CARD)).resolves.toBe(true);
    expect(native.startCardReturn).toHaveBeenCalledExactlyOnceWith(CARD);
  });

  it('keeps the refusal of a return while another move is pending', async () => {
    const { store, native } = await started([INTERNAL, card()]);
    native.startCardReturn.mockRejectedValue(
      Object.assign(new Error('refused'), {
        code: CODES.moveErrors.inProgress,
      }),
    );
    await expect(store.getState().returnCard(CARD)).resolves.toBe(false);
    expect(store.getState().error).toBe(CODES.moveErrors.inProgress);
  });

  it('drops a return behind a pending request', async () => {
    const { store, native } = await started([INTERNAL, card()]);
    const resuming = store.getState().resumeMove();
    await expect(store.getState().returnCard(CARD)).resolves.toBe(false);
    await resuming;
    expect(native.startCardReturn).not.toHaveBeenCalled();
  });
});
