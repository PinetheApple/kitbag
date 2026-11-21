import {
  bundleTempoOf,
  TEMPO_MODE,
  TEMPO_SOURCE,
  type BundleTempo,
  type FittedTempo,
} from '@kitbag/core-db';

import {
  detectedMeter,
  type DetectedGrid,
} from '../stemPlayer/meterOverride.ts';

export function fittedOf({
  bpm,
  anchorSec,
  beatsPerBar,
}: {
  readonly bpm: number;
  readonly anchorSec: number;
  readonly beatsPerBar: number;
}): FittedTempo {
  return { bpm, anchor: anchorSec, beatsPerBar };
}

export function analysedTempo(
  fit: FittedTempo | null,
  grid: DetectedGrid,
): BundleTempo | null {
  if (grid.beats.length === 0) return null;
  const unfitted: BundleTempo = {
    mode: TEMPO_MODE.follow,
    bpm: null,
    anchor: null,
    beatsPerBar: detectedMeter(grid).meter,
    source: TEMPO_SOURCE.analysed,
  };
  if (fit === null) return unfitted;
  return bundleTempoOf({ ...unfitted, ...fit }) ?? unfitted;
}
