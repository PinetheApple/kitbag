import { TEMPO_MODE, TEMPO_SOURCE } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import type { TempoFitter } from './runtime.ts';
import { fakeFitter, failedFit, setup } from './store.test-helper.ts';

const FIT = {
  result: KB_RESULT.KB_OK,
  bpm: 120.5,
  anchorSec: 0.5,
  beatsPerBar: 4,
};
const FITTED = {
  mode: TEMPO_MODE.follow,
  bpm: FIT.bpm,
  anchor: FIT.anchorSec,
  beatsPerBar: FIT.beatsPerBar,
  source: TEMPO_SOURCE.analysed,
};
async function importedTempo(fitter = fakeFitter(FIT)) {
  const library = setup(undefined, fitter);
  await library.store.getState().importStemFolder();
  const [row] = library.store.getState().rows;
  if (row === undefined) throw new Error('no row');
  return { ...library, fitter, set: await library.records.readStemSet(row.id) };
}

describe('a stem song imported with beats but no tempo', () => {
  it('stores the fit over its beats and bars', async () => {
    const { set, fitter } = await importedTempo();
    expect(fitter).toHaveBeenCalledWith([0.5, 1], [0]);
    expect(set?.tempo).toEqual(FITTED);
  });

  it('stores no steady tempo when the fit fails', async () => {
    const { set } = await importedTempo(fakeFitter(failedFit()));
    expect(set?.tempo).toMatchObject({
      mode: TEMPO_MODE.follow,
      bpm: null,
      anchor: null,
      source: TEMPO_SOURCE.analysed,
    });
  });

  it('is added without a tempo when the fit cannot run', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fitter = vi.fn<TempoFitter>(() =>
      Promise.reject(new Error('bridge')),
    );
    const { set } = await importedTempo(fitter);
    expect(set?.tempo).toBeNull();
    expect(set?.beats).toEqual([0.5, 1]);
  });
});

describe('a stem song left without a tempo', () => {
  it('gets its fit at the next start, once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fitter = vi.fn<TempoFitter>(() =>
      Promise.reject(new Error('bridge')),
    );
    const { store, records, set } = await importedTempo(fitter);
    fitter.mockImplementation(() => Promise.resolve(FIT));
    const stop = await store.getState().start();
    stop();
    expect((await records.readStemSet(set?.id ?? -1))?.tempo).toEqual(FITTED);
    fitter.mockClear();
    (await store.getState().start())();
    expect(fitter).not.toHaveBeenCalled();
  });
});
