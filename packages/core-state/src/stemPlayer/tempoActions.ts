import {
  canBuildTempoMode,
  type BundleTempo,
  type MeterOverride,
  type StemSetRecord,
  type TempoMode,
} from '@kitbag/core-db';

import { anchoredMeter } from '../manualTempo/manualGrid.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import {
  MANUAL_TEMPO_FACT,
  NO_CLICK_FACT,
  songFacts,
  type PlaybackShift,
  type SongFacts,
} from './facts.ts';
import { overrideDownbeats, type DetectedGrid } from './meterOverride.ts';
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

function withTempoFact(
  facts: SongFacts,
  record: StemSetRecord,
  grid: DetectedGrid,
): SongFacts {
  if (record.manualTempo !== null)
    return { ...facts, tempo: MANUAL_TEMPO_FACT };
  return grid.beats.length === 0 ? { ...facts, tempo: NO_CLICK_FACT } : facts;
}

export function gridFacts(
  record: StemSetRecord,
  mode: TempoMode | null,
  shift: PlaybackShift,
  grid: DetectedGrid = effectiveGrid(record, mode),
): Pick<GridState, 'facts' | 'recordedFacts'> {
  const source = { ...record, bpm: gridBpm(record, mode) };
  return {
    facts: withTempoFact(songFacts(source, shift), record, grid),
    recordedFacts: withTempoFact(songFacts(source), record, grid),
  };
}

export function songGrid(
  record: StemSetRecord,
  mode: TempoMode | null,
  override: MeterOverride,
  shift: PlaybackShift,
): { readonly marked: readonly number[]; readonly state: GridState } {
  const grid = effectiveGrid(record, mode);
  const { detected, override: anchored } = anchoredMeter(
    grid,
    record.manualTempo,
    override,
  );
  return {
    marked: grid.downbeatIndices,
    state: {
      tempoMode: mode,
      ...gridFacts(record, mode, shift, grid),
      beats: grid.beats,
      downbeatIndices: overrideDownbeats(grid, anchored),
      detectedMeter: detected.meter,
      detectedBarOneSeconds: detected.barOneSeconds,
    },
  };
}

export interface TempoSwitchTarget {
  readonly id: number | null;
  readonly ready: boolean;
  readonly tempo: BundleTempo | null;
  readonly tempoMode: TempoMode | null;
}

export interface TempoSwitchContext {
  readonly target: () => TempoSwitchTarget;
  readonly session: () => number;
  readonly save: (id: number, mode: TempoMode) => Promise<void>;
  readonly applyGrid: (mode: TempoMode) => void;
}

export function tempoModeSwitch({
  target,
  session,
  save,
  applyGrid,
}: TempoSwitchContext): (mode: TempoMode) => Promise<void> {
  let switches = 0;
  return async (mode) => {
    const { ready, id, tempo, tempoMode: previous } = target();
    if (!ready || id === null || previous === null) return;
    if (mode === previous || !canBuildTempoMode(tempo, mode)) return;
    const opened = session();
    const switched = ++switches;
    applyGrid(mode);
    try {
      await save(id, mode);
    } catch (error: unknown) {
      warn('tempo mode not stored', error);
      if (opened === session() && switched === switches) applyGrid(previous);
    }
  };
}

export function tempoActions(
  { get, runtimeOf, session }: ActionContext,
  applyGrid: (mode: TempoMode) => void,
): Pick<StemPlayerActions, 'setTempoMode'> {
  return {
    setTempoMode: tempoModeSwitch({
      target: () => {
        const { status, setId, tempo, tempoMode } = get();
        return { ready: status === 'ready', id: setId, tempo, tempoMode };
      },
      session,
      save: (id, mode) =>
        runtimeOf().records.saveStemSetChosenTempoMode(id, mode),
      applyGrid,
    }),
  };
}
