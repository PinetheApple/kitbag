import { describe, expect, it, vi } from 'vitest';

import { DATA_FOLDER_CODES as CODES } from './codes.test-helper.ts';
import { offeredCards, returnedCards, returnSourceMissing } from './store.ts';
import {
  CARD,
  INTERNAL,
  VOLUMES,
  card,
  started,
  status,
} from './store.test-helper.ts';

const UNMOUNTED = card({ state: CODES.volumeStates.unmounted });

describe('declining a returned card', () => {
  it('stops offering the card on the list but keeps it in Settings', async () => {
    const returned = card();
    const { store } = await started([INTERNAL, returned]);
    expect(offeredCards(store.getState())).toEqual([returned]);
    store.getState().declineReturn(CARD);
    expect(offeredCards(store.getState())).toEqual([]);
    expect(returnedCards(store.getState())).toEqual([returned]);
  });

  it('offers the card again once it is taken out and put back', async () => {
    const returned = card();
    const { store, native, folderChanged } = await started([
      INTERNAL,
      returned,
    ]);
    store.getState().declineReturn(CARD);
    const mountAs = async (volume: typeof returned) => {
      native.listVolumes.mockResolvedValue({
        ...VOLUMES,
        volumes: [INTERNAL, volume],
      });
      folderChanged();
      await vi.waitFor(() => {
        expect(store.getState().volumes?.volumes[1]).toBe(volume);
      });
    };
    await mountAs(card({ awayBytes: 1_201 }));
    expect(offeredCards(store.getState())).toEqual([]);
    await mountAs(UNMOUNTED);
    await mountAs(returned);
    expect(offeredCards(store.getState())).toEqual([returned]);
  });
});

describe('a return whose card is out', () => {
  const RETURNING = status({
    running: false,
    paused: true,
    sourceVolumeUuid: CARD,
    targetVolumeUuid: null,
    cardReturn: true,
  });

  it('knows the card is out while it is unmounted', async () => {
    const { store, progress } = await started([INTERNAL, UNMOUNTED]);
    progress(RETURNING);
    expect(returnSourceMissing(store.getState())).toBe(true);
  });

  it('does not while the card is in, or for an ordinary move', async () => {
    const { store, progress } = await started([INTERNAL, card()]);
    progress(RETURNING);
    expect(returnSourceMissing(store.getState())).toBe(false);
    progress(status({ sourceVolumeUuid: CARD, cardReturn: false }));
    expect(returnSourceMissing(store.getState())).toBe(false);
  });
});
