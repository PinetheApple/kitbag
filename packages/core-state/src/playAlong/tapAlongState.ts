import type { BeatSource, TapLockResult, TapOffset } from './tapLock.ts';

export const TAP_STEP = {
  tapping: 'tapping',
  chooseTempo: 'chooseTempo',
  chooseOne: 'chooseOne',
  oneSet: 'oneSet',
} as const;

export type TapStep = (typeof TAP_STEP)[keyof typeof TAP_STEP];

export const TAPS_CLEARED = { seek: 'seek', track: 'track' } as const;

export type TapsCleared = (typeof TAPS_CLEARED)[keyof typeof TAPS_CLEARED];

export const TAP_STOP_BEATS = 2;
export const TAP_STOP_MIN_MS = 1000;
export const ONE_SET_SHOWN_MS = 2500;

export interface TappedTempo {
  readonly beatSource: BeatSource;
  readonly keptTaps: number;
}

export interface TempoChoice {
  readonly tappedBpm: number;
  readonly songBpm: number;
  readonly keptTaps: number;
  readonly tappedDownbeatSec: number;
}

export interface TapAlong {
  readonly step: TapStep;
  readonly taps: readonly number[];
  readonly offsets: readonly TapOffset[];
  readonly result: TapLockResult | undefined;
  readonly halfOrDoubleBpm: number | undefined;
  readonly tempoChoice: TempoChoice | undefined;
  readonly movedBeats: number;
  readonly cleared: TapsCleared | undefined;
}

export const NO_TAPS: TapAlong = {
  step: TAP_STEP.tapping,
  taps: [],
  offsets: [],
  result: undefined,
  halfOrDoubleBpm: undefined,
  tempoChoice: undefined,
  movedBeats: 0,
  cleared: undefined,
};

export interface TapAlongState {
  readonly tapAlong: TapAlong;
}

export interface TapAlongActions {
  readonly tapToLock: (atBoottimeMs: number) => boolean;
  readonly askForOne: () => void;
  readonly keepAccent: () => void;
  readonly chooseTappedTempo: () => void;
  readonly chooseSongTempo: () => void;
  readonly startTapsOver: () => void;
  readonly forgetClearedTaps: () => void;
}
