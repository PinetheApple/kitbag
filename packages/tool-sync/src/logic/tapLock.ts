import {
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
  TAPS_TO_SET_TEMPO,
} from '@kitbag/core-state';

export const TAP_LOCK_WINDOW = 8;
export const TAP_OUTLIER_MS = 60;
export const TAP_AGREE_MS = 30;
export const SAME_TEMPO_SHARE = 0.04;
export const OTHER_TEMPO_SHARE = 0.06;

const MS_PER_MINUTE = SECONDS_PER_MINUTE * MS_PER_SECOND;
const FULL_TURN = 2 * Math.PI;
const HALF = 2;
const TAP_BEATS_PER_SONG_BEAT = [1, HALF, 1 / HALF] as const;

export const TAP_LOCK_MISS = {
  tooFew: 'tooFew',
  spread: 'spread',
  unsure: 'unsure',
  disagrees: 'disagrees',
} as const;

export type TapLockMiss = (typeof TAP_LOCK_MISS)[keyof typeof TAP_LOCK_MISS];

export const BEAT_SOURCE = { song: 'song', taps: 'taps' } as const;

export type BeatSource = (typeof BEAT_SOURCE)[keyof typeof BEAT_SOURCE];

export interface BeatGrid {
  readonly phaseMs: number;
  readonly beatMs: number;
}

export interface TapLocked extends BeatGrid {
  readonly locked: true;
  readonly bpm: number;
  readonly beatSource: BeatSource;
  readonly spreadMs: number;
  readonly keptTaps: number;
}

export interface TapLockRefused {
  readonly locked: false;
  readonly reason: TapLockMiss;
  readonly spreadMs: number | null;
  readonly tappedBpm: number | null;
}

export type TapLockResult = TapLocked | TapLockRefused;

export interface DownbeatPick {
  readonly beatIndex: number;
  readonly barOffsetMs: number;
}

interface Kept {
  readonly centre: number;
  readonly kept: readonly boolean[];
  readonly count: number;
  readonly spreadMs: number;
}

interface TappedBeat {
  readonly beatMs: number;
  readonly count: number;
}

interface Tempo {
  readonly bpm: number;
  readonly gridMs: number;
  readonly beatSource: BeatSource;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / HALF);
  const upper = sorted[mid] ?? Number.NaN;
  if (sorted.length % HALF === 1) return upper;
  return ((sorted[mid - 1] ?? Number.NaN) + upper) / HALF;
}

const wrapped = (ms: number, beatMs: number): number =>
  ms - beatMs * Math.round(ms / beatMs);

const phaseOf = (ms: number, beatMs: number): number =>
  ((ms % beatMs) + beatMs) % beatMs;

const wrappedIndex = (index: number, size: number): number =>
  ((index % size) + size) % size;

const bpmOf = (beatMs: number): number => MS_PER_MINUTE / beatMs;

function keepNearMedian(values: readonly number[]): Kept {
  const first = median(values);
  const kept = values.map((v) => Math.abs(v - first) <= TAP_OUTLIER_MS);
  const inliers = values.filter((_v, i) => kept[i]);
  const centre = median(inliers);
  const spreadMs = median(inliers.map((v) => Math.abs(v - centre)));
  return { centre, kept, count: inliers.length, spreadMs };
}

function circularMean(taps: readonly number[], beatMs: number): number {
  const angles = taps.map((t) => (phaseOf(t, beatMs) / beatMs) * FULL_TURN);
  const sin = angles.reduce((sum, a) => sum + Math.sin(a), 0);
  const cos = angles.reduce((sum, a) => sum + Math.cos(a), 0);
  return (Math.atan2(sin, cos) / FULL_TURN) * beatMs;
}

interface Line {
  readonly slope: number;
  readonly intercept: number;
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

function lineFit(xs: readonly number[], ys: readonly number[]): Line {
  const meanX = mean(xs);
  const meanY = mean(ys);
  const cov = xs.reduce(
    (sum, x, i) => sum + (x - meanX) * ((ys[i] ?? 0) - meanY),
    0,
  );
  const varX = xs.reduce((sum, x) => sum + (x - meanX) ** HALF, 0);
  const slope = varX > 0 ? cov / varX : Number.NaN;
  return { slope, intercept: meanY - slope * meanX };
}

function beatNumbers(taps: readonly number[], step: number): number[] {
  let beat = 0;
  return taps.map((t, i) => {
    if (i > 0) beat += Math.max(1, Math.round((t - (taps[i - 1] ?? t)) / step));
    return beat;
  });
}

function tappedBeat(taps: readonly number[]): TappedBeat | undefined {
  const step = median(taps.slice(1).map((t, i) => t - (taps[i] ?? t)));
  if (!(step > 0)) return undefined;
  const beats = beatNumbers(taps, step);
  const rough = lineFit(beats, taps);
  const residuals = taps.map(
    (t, i) => t - rough.intercept - rough.slope * (beats[i] ?? 0),
  );
  const { kept, count } = keepNearMedian(residuals);
  const { slope } = lineFit(
    beats.filter((_b, i) => kept[i]),
    taps.filter((_t, i) => kept[i]),
  );
  return slope > 0 ? { beatMs: slope, count } : undefined;
}

function songTempo(tappedMs: number, songBpm: number): Tempo | TapLockMiss {
  const songMs = bpmOf(songBpm);
  const shares = TAP_BEATS_PER_SONG_BEAT.map((ratio) =>
    Math.abs(tappedMs / (songMs / ratio) - 1),
  );
  const best = Math.min(...shares);
  const ratio = TAP_BEATS_PER_SONG_BEAT[shares.indexOf(best)] ?? 1;
  if (best > OTHER_TEMPO_SHARE) return TAP_LOCK_MISS.disagrees;
  if (best > SAME_TEMPO_SHARE) return TAP_LOCK_MISS.unsure;
  return { bpm: songBpm, gridMs: songMs / ratio, beatSource: BEAT_SOURCE.song };
}

const tempoFor = (tappedMs: number, songBpm: number | null) =>
  songBpm === null
    ? { bpm: bpmOf(tappedMs), gridMs: tappedMs, beatSource: BEAT_SOURCE.taps }
    : songTempo(tappedMs, songBpm);

const refused = (
  reason: TapLockMiss,
  tappedBpm: number | null,
  spreadMs: number | null = null,
): TapLockRefused => ({ locked: false, reason, spreadMs, tappedBpm });

export function tapLock(
  taps: readonly number[],
  songBpm: number | null,
): TapLockResult {
  const recent = taps.slice(-TAP_LOCK_WINDOW);
  const tapped = tappedBeat(recent);
  if (tapped === undefined || tapped.count < TAPS_TO_SET_TEMPO)
    return refused(TAP_LOCK_MISS.tooFew, tapped ? bpmOf(tapped.beatMs) : null);
  const tappedBpm = bpmOf(tapped.beatMs);
  const tempo = tempoFor(tapped.beatMs, songBpm);
  if (typeof tempo === 'string') return refused(tempo, tappedBpm);
  const reference = circularMean(recent, tempo.gridMs);
  const phase = keepNearMedian(
    recent.map((t) => wrapped(t - reference, tempo.gridMs)),
  );
  if (phase.count < TAPS_TO_SET_TEMPO)
    return refused(TAP_LOCK_MISS.tooFew, tappedBpm);
  if (phase.spreadMs > TAP_AGREE_MS)
    return refused(TAP_LOCK_MISS.spread, tappedBpm, phase.spreadMs);
  const beatMs = bpmOf(tempo.bpm);
  return {
    locked: true,
    bpm: tempo.bpm,
    beatMs,
    phaseMs: phaseOf(reference + phase.centre, beatMs),
    beatSource: tempo.beatSource,
    spreadMs: phase.spreadMs,
    keptTaps: phase.count,
  };
}

export const barOffsetForBeat = (
  grid: BeatGrid,
  beatsPerBar: number,
  beatIndex: number,
): number => grid.phaseMs + wrappedIndex(beatIndex, beatsPerBar) * grid.beatMs;

export function downbeatFromTap(
  grid: BeatGrid,
  beatsPerBar: number,
  tapMs: number,
): DownbeatPick {
  const beatIndex = wrappedIndex(
    Math.round((tapMs - grid.phaseMs) / grid.beatMs),
    beatsPerBar,
  );
  return {
    beatIndex,
    barOffsetMs: barOffsetForBeat(grid, beatsPerBar, beatIndex),
  };
}
