import { confirmNumpadEntry, type NumpadEntry } from '@kitbag/core-design';
import {
  GRID_METER,
  isGridMeter,
  manualBpm,
  MANUAL_TEMPO_BOUNDS,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  stepManualBpm,
  TEMPO_MIN_ANCHOR_SECONDS,
  type GridMeter,
  type ManualTempo,
} from '@kitbag/core-state';

const HALF_TIME = 0.5;
const DOUBLE_TIME = 2;
const UNBOUNDED = {
  min: Number.NEGATIVE_INFINITY,
  max: Number.POSITIVE_INFINITY,
};
export const NUDGE_MS = 10;
export const DEFAULT_METER: GridMeter = GRID_METER.quadruple;

export interface TempoDraft extends ManualTempo {
  readonly nudgedMs: number;
}

export interface TempoSeed {
  readonly bpm: number | null;
  readonly anchor: number | null;
  readonly beatsPerBar: GridMeter;
  readonly analysed: boolean;
}

export const NO_SEED: TempoSeed = {
  bpm: null,
  anchor: null,
  beatsPerBar: DEFAULT_METER,
  analysed: false,
};

export interface SeedSource {
  readonly manualTempo: ManualTempo | null;
  readonly analysedBpm: number | null;
  readonly barOneSeconds: number;
  readonly meter: number;
}

export function tempoSeed({
  manualTempo,
  analysedBpm,
  barOneSeconds,
  meter,
}: SeedSource): TempoSeed {
  if (manualTempo !== null) return { ...manualTempo, analysed: false };
  if (analysedBpm === null) return NO_SEED;
  return {
    bpm: manualBpm(analysedBpm),
    anchor: barOneSeconds,
    beatsPerBar: isGridMeter(meter) ? meter : DEFAULT_METER,
    analysed: true,
  };
}

export const typedValue = (entry: NumpadEntry) =>
  confirmNumpadEntry(entry, UNBOUNDED);

export function chosenTypedBpm(
  entry: NumpadEntry,
  seeded: number | null,
): number | undefined {
  if (entry.untouched) return seeded ?? undefined;
  return confirmNumpadEntry(entry, MANUAL_TEMPO_BOUNDS);
}

export function shownTypedBpm(
  entry: NumpadEntry,
  seeded: number | null,
): number | undefined {
  return entry.untouched ? (seeded ?? undefined) : typedValue(entry);
}

export const halfOf = (bpm: number) => Math.round(bpm * HALF_TIME);
export const doubleOf = (bpm: number) => Math.round(bpm * DOUBLE_TIME);

export function anchorWithin(anchor: number, durationSec: number): number {
  return Math.min(Math.max(anchor, TEMPO_MIN_ANCHOR_SECONDS), durationSec);
}

export function startDraft(
  bpm: number,
  from: Pick<TempoSeed, 'anchor' | 'beatsPerBar'>,
  playheadSec: number,
): TempoDraft {
  return {
    bpm: manualBpm(bpm),
    anchor: from.anchor ?? playheadSec,
    beatsPerBar: from.beatsPerBar,
    nudgedMs: 0,
  };
}

export function movedByBeats(
  draft: TempoDraft,
  beats: number,
  durationSec: number,
): TempoDraft {
  const period = SECONDS_PER_MINUTE / draft.bpm;
  const anchor = anchorWithin(draft.anchor + beats * period, durationSec);
  return { ...draft, anchor, nudgedMs: 0 };
}

export function nudged(
  draft: TempoDraft,
  ms: number,
  durationSec: number,
): TempoDraft {
  const atMs = Math.round(draft.anchor * MS_PER_SECOND) + ms;
  const anchor = anchorWithin(atMs / MS_PER_SECOND, durationSec);
  if (anchor === draft.anchor) return draft;
  return { ...draft, anchor, nudgedMs: draft.nudgedMs + ms };
}

export function markedAt(draft: TempoDraft, seconds: number): TempoDraft {
  return { ...draft, anchor: seconds, nudgedMs: 0 };
}

export function stepped(draft: TempoDraft, steps: number): TempoDraft {
  return { ...draft, bpm: stepManualBpm(draft.bpm, steps) };
}

export function beatsFromBarOne(
  seconds: number,
  { anchor, bpm }: Pick<ManualTempo, 'anchor' | 'bpm'>,
): number {
  'worklet';
  return ((seconds - anchor) * bpm) / SECONDS_PER_MINUTE;
}

export const manualTempoOf = ({
  bpm,
  anchor,
  beatsPerBar,
}: TempoDraft): ManualTempo => ({ bpm, anchor, beatsPerBar });
