import { describe, expect, it, vi } from 'vitest';

import { DATA_FOLDER_CODES as CODES } from './codes.test-helper.ts';
import { returnedCards } from './store.ts';
import {
  CARD,
  INTERNAL,
  VOLUMES,
  card,
  rejection,
  started,
  status,
} from './store.test-helper.ts';

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

  it('lists none while the data folder itself is unavailable', async () => {
    const { store, native, folderChanged } = await started([INTERNAL, card()]);
    native.listVolumes.mockResolvedValue({
      ...VOLUMES,
      currentAvailable: false,
      volumes: [INTERNAL, card()],
    });
    folderChanged();
    await vi.waitFor(() => {
      expect(store.getState().volumes?.currentAvailable).toBe(false);
    });
    expect(returnedCards(store.getState())).toEqual([]);
  });

  it('recounts an offered card when the data folder reports a change, without restarting', async () => {
    const { store, native, folderChanged } = await started([
      INTERNAL,
      card({ awaySongs: 1, awayStemSongs: 1 }),
    ]);
    native.listVolumes.mockResolvedValue({
      ...VOLUMES,
      volumes: [INTERNAL, card({ awaySongs: 1, awayStemSongs: 0 })],
    });
    folderChanged();
    await vi.waitFor(() => {
      expect(returnedCards(store.getState())[0]?.awayStemSongs).toBe(0);
    });
    expect(native.watchDataFolder).toHaveBeenCalledOnce();
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
      rejection(CODES.moveErrors.inProgress),
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
