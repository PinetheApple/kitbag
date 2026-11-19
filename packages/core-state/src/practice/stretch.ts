import {
  isStemSong,
  type LoggedCountIn,
  type LoggedSetlist,
  type LoggedSettings,
  type LoggedSong,
  type LoggedStretch,
  type StretchEnd,
  type TempoChange,
} from '@kitbag/core-db';

import {
  averageBpm,
  sampled,
  startAverage,
  type TempoAverage,
} from './tempo.ts';

export const TEMPO_SETTLE_MS = 1500;
// Loading a song applies a dozen settings in one go; changes this close to a
// stretch's start fold into it instead of each opening a stretch of their own.
export const STRETCH_FOLD_MS = 250;

export interface StretchSetup {
  readonly settings: LoggedSettings;
  readonly countIn: LoggedCountIn;
}

export interface StretchPlace {
  readonly song: LoggedSong | null;
  readonly setlist: LoggedSetlist | null;
}

interface TempoBurst {
  readonly offset: number;
  readonly bpm: number;
  readonly changedAt: number;
}

export interface OpenStretch extends StretchPlace {
  readonly from: number;
  readonly setup: StretchSetup | null;
  readonly startBpm: number;
  readonly tempo: readonly TempoChange[];
  readonly burst: TempoBurst | null;
  readonly average: TempoAverage;
}

export function openStretch(
  place: StretchPlace,
  setup: StretchSetup,
  at: number,
  bpm: number,
): OpenStretch {
  const stem = place.song !== null && isStemSong(place.song);
  return {
    ...place,
    from: at,
    setup: stem ? null : setup,
    startBpm: bpm,
    tempo: [],
    burst: null,
    average: startAverage(at, bpm),
  };
}

export function isFolding(open: OpenStretch, at: number): boolean {
  return at - open.from < STRETCH_FOLD_MS;
}

export function refolded(
  open: OpenStretch,
  place: StretchPlace,
  setup: StretchSetup,
  bpm: number,
): OpenStretch {
  return openStretch(place, setup, open.from, bpm);
}

function settledTempo(open: OpenStretch): readonly TempoChange[] {
  const { burst, tempo } = open;
  if (burst === null) return tempo;
  const before = tempo.at(-1)?.[1] ?? open.startBpm;
  return burst.bpm === before ? tempo : [...tempo, [burst.offset, burst.bpm]];
}

export function stretchAfterTempo(
  open: OpenStretch,
  at: number,
  bpm: number,
): OpenStretch {
  const { burst } = open;
  const average = sampled(open.average, at, bpm);
  if (burst !== null && at - burst.changedAt < TEMPO_SETTLE_MS)
    return { ...open, average, burst: { ...burst, bpm, changedAt: at } };
  return {
    ...open,
    average,
    tempo: settledTempo(open),
    burst: { offset: at - open.from, bpm, changedAt: at },
  };
}

export function stretchAfterSample(
  open: OpenStretch,
  at: number,
  bpm: number,
): OpenStretch {
  return { ...open, average: sampled(open.average, at, bpm) };
}

export function closedStretch(
  open: OpenStretch,
  sessionStart: number,
  at: number,
  end: StretchEnd,
  bpm: number,
): LoggedStretch | null {
  if (isFolding(open, at)) return null;
  return {
    from: open.from - sessionStart,
    to: at - sessionStart,
    end,
    song: open.song,
    setlist: open.setlist,
    settings: open.setup?.settings ?? null,
    countIn: open.setup?.countIn ?? null,
    tempo: settledTempo(open),
    endBpm: bpm,
    avgBpm: averageBpm(sampled(open.average, at, bpm)),
  };
}

export function withLastEnd(
  stretches: readonly LoggedStretch[],
  to: number,
  end: StretchEnd,
): readonly LoggedStretch[] {
  const last = stretches.at(-1);
  if (last?.to !== to) return stretches;
  return [...stretches.slice(0, -1), { ...last, end }];
}
