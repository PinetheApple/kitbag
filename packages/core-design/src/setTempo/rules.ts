import type { NumberBounds } from '../numpadEntry.ts';

export interface TempoValue<M extends number> {
  readonly bpm: number;
  readonly anchor: number;
  readonly beatsPerBar: M;
}

export interface SetTempoRules<M extends number> {
  readonly bounds: NumberBounds;
  readonly bpmStep: number;
  readonly tapsToSet: number;
  readonly minAnchorSeconds: number;
  readonly msPerSecond: number;
  readonly secondsPerMinute: number;
  readonly meters: readonly M[];
  readonly defaultMeter: M;
  readonly isMeter: (value: number) => value is M;
  readonly roundBpm: (bpm: number) => number;
  readonly stepBpm: (bpm: number, steps: number) => number;
  readonly pushTap: (
    taps: readonly number[],
    atMs: number,
  ) => readonly number[];
  readonly tappedBpm: (taps: readonly number[]) => number | null;
  readonly minus: string;
}
