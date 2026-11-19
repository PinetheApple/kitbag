import type { MeterOverridePatch, TempoCorrection } from '@kitbag/core-db';

import type { SongLibraryDeps } from './store.ts';
import { warn, type Get } from './storeSupport.ts';

export function songGridSaves(deps: SongLibraryDeps, get: Get) {
  const saved = async (
    what: string,
    songId: number,
    write: () => Promise<void>,
  ) => {
    try {
      await write();
    } catch (error) {
      warn(`${what} of song ${String(songId)} not stored`, error);
      return false;
    }
    await get().refresh();
    return true;
  };
  return {
    saveSongMeterOverride: (songId: number, patch: MeterOverridePatch) =>
      saved('meter', songId, () =>
        deps.records().saveSongMeterOverride(songId, patch),
      ),
    saveSongTempoCorrection: (songId: number, correction: TempoCorrection) =>
      saved('tempo correction', songId, () =>
        deps.records().saveSongTempoCorrection(songId, correction),
      ),
  };
}
