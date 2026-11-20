import {
  canBuildTempoMode,
  type MeterOverride,
  type StemSetRecord,
  type TempoMode,
} from '@kitbag/core-db';

import { warn } from '../songLibrary/storeSupport.ts';
import { songFacts, type PlaybackShift } from './facts.ts';
import { detectedMeter, overrideDownbeats } from './meterOverride.ts';
import type {
  ActionContext,
  StemPlayerActions,
  StemPlayerState,
} from './store.ts';
import { effectiveGrid, gridBpm } from './tempoGrid.ts';

type GridState = Pick<
  StemPlayerState,
  | 'tempoMode'
  | 'facts'
  | 'recordedFacts'
  | 'beats'
  | 'downbeatIndices'
  | 'detectedMeter'
  | 'detectedBarOneSeconds'
>;

export function gridFacts(
  record: StemSetRecord,
  mode: TempoMode | null,
  shift: PlaybackShift,
): Pick<GridState, 'facts' | 'recordedFacts'> {
  const source = { ...record, bpm: gridBpm(record, mode) };
  return { facts: songFacts(source, shift), recordedFacts: songFacts(source) };
}

export function songGrid(
  record: StemSetRecord,
  mode: TempoMode | null,
  override: MeterOverride,
  shift: PlaybackShift,
): { readonly marked: readonly number[]; readonly state: GridState } {
  const grid = effectiveGrid(record, mode);
  const detected = detectedMeter(grid);
  return {
    marked: grid.downbeatIndices,
    state: {
      tempoMode: mode,
      ...gridFacts(record, mode, shift),
      beats: grid.beats,
      downbeatIndices: overrideDownbeats(grid, override),
      detectedMeter: detected.meter,
      detectedBarOneSeconds: detected.barOneSeconds,
    },
  };
}

export function tempoActions(
  { get, runtimeOf, session }: ActionContext,
  applyGrid: (mode: TempoMode) => void,
): Pick<StemPlayerActions, 'setTempoMode'> {
  let switches = 0;
  return {
    setTempoMode: async (mode) => {
      const { status, setId, tempo, tempoMode: previous } = get();
      if (status !== 'ready' || setId === null || previous === null) return;
      if (mode === previous || !canBuildTempoMode(tempo, mode)) return;
      const opened = session();
      const switched = ++switches;
      applyGrid(mode);
      try {
        await runtimeOf().records.saveStemSetChosenTempoMode(setId, mode);
      } catch (error: unknown) {
        warn('tempo mode not stored', error);
        if (opened === session() && switched === switches) applyGrid(previous);
      }
    },
  };
}
