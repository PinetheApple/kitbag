import { confirmNumpadEntry, type NumpadEntry } from '../numpadEntry.ts';
import type { SetTempoRules, TempoValue } from './rules.ts';

const HALF_TIME = 0.5;
const DOUBLE_TIME = 2;
const UNBOUNDED = {
  min: Number.NEGATIVE_INFINITY,
  max: Number.POSITIVE_INFINITY,
};
export const NUDGE_MS = 10;

export interface TempoDraft<M extends number> extends TempoValue<M> {
  readonly nudgedMs: number;
}

export interface TempoSeed<M extends number> {
  readonly bpm: number | null;
  readonly anchor: number | null;
  readonly beatsPerBar: M;
  readonly analysed: boolean;
}

export interface SeedSource<M extends number> {
  readonly manualTempo: TempoValue<M> | null;
  readonly analysedBpm: number | null;
  readonly barOneSeconds: number;
  readonly meter: number;
}

export const noSeed = <M extends number>(
  rules: SetTempoRules<M>,
): TempoSeed<M> => ({
  bpm: null,
  anchor: null,
  beatsPerBar: rules.defaultMeter,
  analysed: false,
});

export function tempoSeed<M extends number>(
  { manualTempo, analysedBpm, barOneSeconds, meter }: SeedSource<M>,
  rules: SetTempoRules<M>,
): TempoSeed<M> {
  if (manualTempo !== null) return { ...manualTempo, analysed: false };
  if (analysedBpm === null) return noSeed(rules);
  return {
    bpm: rules.roundBpm(analysedBpm),
    anchor: barOneSeconds,
    beatsPerBar: rules.isMeter(meter) ? meter : rules.defaultMeter,
    analysed: true,
  };
}

export const typedValue = (entry: NumpadEntry) =>
  confirmNumpadEntry(entry, UNBOUNDED);

export function chosenTypedBpm<M extends number>(
  entry: NumpadEntry,
  seeded: number | null,
  rules: SetTempoRules<M>,
): number | undefined {
  if (entry.untouched) return seeded ?? undefined;
  return confirmNumpadEntry(entry, rules.bounds);
}

export function shownTypedBpm(
  entry: NumpadEntry,
  seeded: number | null,
): number | undefined {
  return entry.untouched ? (seeded ?? undefined) : typedValue(entry);
}

export const halfOf = (bpm: number) => Math.round(bpm * HALF_TIME);
export const doubleOf = (bpm: number) => Math.round(bpm * DOUBLE_TIME);

export function anchorWithin<M extends number>(
  anchor: number,
  durationSec: number,
  rules: SetTempoRules<M>,
): number {
  return Math.min(Math.max(anchor, rules.minAnchorSeconds), durationSec);
}

export function startDraft<M extends number>(
  bpm: number,
  from: Pick<TempoSeed<M>, 'anchor' | 'beatsPerBar'>,
  playheadSec: number,
  rules: SetTempoRules<M>,
): TempoDraft<M> {
  return {
    bpm: rules.roundBpm(bpm),
    anchor: from.anchor ?? playheadSec,
    beatsPerBar: from.beatsPerBar,
    nudgedMs: 0,
  };
}

export function movedByBeats<M extends number>(
  draft: TempoDraft<M>,
  beats: number,
  durationSec: number,
  rules: SetTempoRules<M>,
): TempoDraft<M> {
  const period = rules.secondsPerMinute / draft.bpm;
  const anchor = anchorWithin(
    draft.anchor + beats * period,
    durationSec,
    rules,
  );
  return { ...draft, anchor, nudgedMs: 0 };
}

export function nudged<M extends number>(
  draft: TempoDraft<M>,
  ms: number,
  durationSec: number,
  rules: SetTempoRules<M>,
): TempoDraft<M> {
  const { msPerSecond } = rules;
  const atMs = Math.round(draft.anchor * msPerSecond) + ms;
  const anchor = anchorWithin(atMs / msPerSecond, durationSec, rules);
  if (anchor === draft.anchor) return draft;
  return { ...draft, anchor, nudgedMs: draft.nudgedMs + ms };
}

export function markedAt<M extends number>(
  draft: TempoDraft<M>,
  seconds: number,
): TempoDraft<M> {
  return { ...draft, anchor: seconds, nudgedMs: 0 };
}

export function stepped<M extends number>(
  draft: TempoDraft<M>,
  steps: number,
  rules: SetTempoRules<M>,
): TempoDraft<M> {
  return { ...draft, bpm: rules.stepBpm(draft.bpm, steps) };
}

export function beatsFromBarOne(
  seconds: number,
  { anchor, bpm }: { readonly anchor: number; readonly bpm: number },
  secondsPerMinute: number,
): number {
  'worklet';
  return ((seconds - anchor) * bpm) / secondsPerMinute;
}

export const tempoValueOf = <M extends number>({
  bpm,
  anchor,
  beatsPerBar,
}: TempoDraft<M>): TempoValue<M> => ({ bpm, anchor, beatsPerBar });
