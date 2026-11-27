import type { ManualTempo, MeterOverride } from '@kitbag/core-db';

import {
  detectedMeter,
  overrideDownbeats,
  type DetectedGrid,
  type DetectedMeter,
} from '../stemPlayer/meterOverride.ts';

export interface AnchoredMeter {
  readonly detected: DetectedMeter;
  readonly override: MeterOverride;
}

// A manual grid reaches back to the song's start, so its first downbeat is not
// bar 1: the anchor the user marked is, and a meter-only override counts from it.
export function anchoredMeter(
  grid: DetectedGrid,
  manualTempo: ManualTempo | null,
  override: MeterOverride,
): AnchoredMeter {
  if (manualTempo === null) return { detected: detectedMeter(grid), override };
  const { beatsPerBar, anchor } = manualTempo;
  const meterOnly =
    override.meterBeatsPerBar !== null && override.barOneSeconds === null;
  return {
    detected: { meter: beatsPerBar, barOneSeconds: anchor },
    override: meterOnly ? { ...override, barOneSeconds: anchor } : override,
  };
}

export function anchoredDownbeats(
  grid: DetectedGrid,
  manualTempo: ManualTempo | null,
  override: MeterOverride,
): readonly number[] {
  return overrideDownbeats(
    grid,
    anchoredMeter(grid, manualTempo, override).override,
  );
}
