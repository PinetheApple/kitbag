import { TEMPO_CORRECTION } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { importOne, setup } from './store.test-helper.ts';

describe("saving a song's tempo correction", () => {
  it('stores it and reports it saved', async () => {
    const { store, records } = setup();
    const row = await importOne(store);
    await expect(
      store
        .getState()
        .saveSongTempoCorrection(row.id, TEMPO_CORRECTION.threeHalves),
    ).resolves.toBe(true);
    await expect(records.readSong(row.id)).resolves.toMatchObject({
      tempoCorrection: TEMPO_CORRECTION.threeHalves,
    });
  });

  it('reports one that cannot be stored', async () => {
    const { store, records } = setup();
    const row = await importOne(store);
    vi.spyOn(records, 'saveSongTempoCorrection').mockRejectedValueOnce(
      new Error('locked'),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(
      store.getState().saveSongTempoCorrection(row.id, TEMPO_CORRECTION.half),
    ).resolves.toBe(false);
  });
});
