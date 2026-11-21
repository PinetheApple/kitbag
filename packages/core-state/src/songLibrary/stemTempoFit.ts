import type { BundleTempo, NewStemBundle } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';

import { barMarkDownbeats } from '../stemPlayer/bars.ts';
import { analysedTempo } from './analysedTempo.ts';
import type { SongLibraryDeps } from './store.ts';
import { warn } from './storeSupport.ts';

type Grid = Pick<NewStemBundle, 'beats' | 'bars'>;

async function fittedTempo(
  deps: SongLibraryDeps,
  { beats, bars }: Grid,
): Promise<BundleTempo | null> {
  const grid = {
    beats,
    downbeatIndices: barMarkDownbeats(bars, beats.length),
  };
  const fit = await deps.fitTempo()(grid.beats, grid.downbeatIndices);
  const fitted =
    fit.result === KB_RESULT.KB_OK
      ? { bpm: fit.bpm, anchor: fit.anchorSec, beatsPerBar: fit.beatsPerBar }
      : null;
  return analysedTempo(fitted, grid);
}

// A fit that cannot run leaves the tempo empty, so the next start tries again.
export async function withFittedTempo(
  deps: SongLibraryDeps,
  bundle: NewStemBundle,
): Promise<NewStemBundle> {
  if (bundle.tempo !== null || bundle.beats.length === 0) return bundle;
  try {
    return { ...bundle, tempo: await fittedTempo(deps, bundle) };
  } catch (error) {
    warn(`tempo fit of ${bundle.title} failed`, error);
    return bundle;
  }
}

export async function fitUntimedStemSets(deps: SongLibraryDeps): Promise<void> {
  const records = deps.records();
  for (const set of await records.listStemSetsWithoutTempo()) {
    try {
      const tempo = await fittedTempo(deps, set);
      if (tempo !== null) await records.saveStemSetTempo(set.id, tempo);
    } catch (error) {
      warn(`tempo fit of stem set ${String(set.id)} failed`, error);
    }
  }
}
