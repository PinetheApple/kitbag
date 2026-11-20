import type { MeterOverride, TempoCorrection } from '@kitbag/core-db';

import type { MixerHold } from '../stemPlayer/mixerSession.ts';
import type { StemPlayerActions } from '../stemPlayer/store.ts';
import type { SongClickActions } from './songClick.ts';

export interface SongSession {
  readonly hold: MixerHold;
  readonly loaded: Promise<void>;
}

export type SongPlayerActions = Pick<
  StemPlayerActions,
  | 'togglePlay'
  | 'scrub'
  | 'cancelScrub'
  | 'seek'
  | 'skip'
  | 'markLoop'
  | 'moveLoopEdge'
  | 'toggleClick'
> &
  SongClickActions & {
    readonly open: (songId: number, waveformBars: number) => SongSession;
    readonly close: () => void;
    readonly meterOverrideChanged: (
      songId: number,
      override: MeterOverride,
    ) => void;
    readonly tempoCorrectionChanged: (
      songId: number,
      correction: TempoCorrection,
    ) => void;
    readonly tempoCorrectionSettled: (songId: number) => void;
    readonly playheadBeatSeconds: () => number | null;
    readonly dismissMeterNotice: () => void;
  };
