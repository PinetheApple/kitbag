import { TEMPO_MAX_BPM, TEMPO_MIN_BPM } from '@kitbag/core-db';
import { MS_PER_SECOND, TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import { beatSeconds } from '@kitbag/core-state/src/playAlong/position.ts';

export const TAP_LOCK_WINDOW = 8;
export const TAP_OUTLIER_MS = 60;
export const TAP_AGREE_MS = 30;
export const TEMPO_AGREE_TOLERANCE = 0.04;
export const TEMPO_DISAGREE_TOLERANCE = 0.06;

const DOUBLE_TIME = 2;
const TAPS_PER_SONG_BEAT = [1, DOUBLE_TIME, 1 / DOUBLE_TIME] as const;
const FULL_TURN = 2 * Math.PI;

export const TAP_LOCK_MISS = {
  tooFew: 'tooFew',
  spread: 'spread',
  unsure: 'unsure',
  disagrees: 'disagrees',
  outOfRange: 'outOfRange',
} as const;

export type TapLockMiss = (typeof TAP_LOCK_MISS)[keyof typeof TAP_LOCK_MISS];

export const BEAT_SOURCE = { song: 'song', taps: 'taps' } as const;

export type BeatSource = (typeof BEAT_SOURCE)[keyof typeof BEAT_SOURCE];

export interface SongTempo {
  readonly bpm: number | null;
  readonly denominator: number;
}

export interface BeatGrid {
  readonly anchorMs: number;
  readonly beatMs: number;
  readonly gridMs: number;
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

interface Inliers {
  readonly centre: number;
  readonly isKept: readonly boolean[];
  readonly count: number;
  readonly spreadMs: number;
}

interface Line {
  readonly slope: number;
  readonly intercept: number;
}

interface TappedBeat {
  readonly beatMs: number;
  readonly taps: readonly number[];
  readonly keptCount: number;
}

interface Tempo {
  readonly bpm: number;
  readonly beatMs: number;
  readonly gridMs: number;
  readonly beatSource: BeatSource;
}

type TempoChoice =
  | { readonly ok: true; readonly tempo: Tempo }
  | { readonly ok: false; readonly reason: TapLockMiss };

interface PhaseFit {
  readonly centreMs: number;
  readonly keptTaps: readonly number[];
  readonly spreadMs: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const upper = sorted[mid] ?? Number.NaN;
  if (sorted.length % 2 === 1) return upper;
  return ((sorted[mid - 1] ?? Number.NaN) + upper) / 2;
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length;

const positiveMod = (value: number, size: number): number =>
  ((value % size) + size) % size;

const nearest = (ms: number, anchorMs: number, stepMs: number): number =>
  anchorMs + stepMs * Math.round((ms - anchorMs) / stepMs);

function circularCentre(values: readonly number[], period: number): number {
  const angles = values.map(
    (v) => (positiveMod(v, period) / period) * FULL_TURN,
  );
  const sin = angles.reduce((sum, a) => sum + Math.sin(a), 0);
  const cos = angles.reduce((sum, a) => sum + Math.cos(a), 0);
  return (Math.atan2(sin, cos) / FULL_TURN) * period;
}

const beatLengthMs = (bpm: number, denominator: number): number =>
  beatSeconds(bpm, denominator) * MS_PER_SECOND;

const bpmFromBeatMs = (beatMs: number, denominator: number): number =>
  beatLengthMs(1, denominator) / beatMs;

const gaps = (taps: readonly number[], span: number): number[] =>
  taps.slice(span).map((t, i) => (t - (taps[i] ?? t)) / span);

// Two-tap gaps cancel a finger that alternates early and late, which skews
// the plain median gap.
const tapStep = (taps: readonly number[]): number =>
  median([...gaps(taps, 1), ...gaps(taps, 2)]);

function inliersNearMedian(values: readonly number[]): Inliers {
  const first = median(values);
  const isKept = values.map((v) => Math.abs(v - first) <= TAP_OUTLIER_MS);
  const kept = values.filter((_v, i) => isKept[i]);
  const centre = median(kept);
  const spreadMs = median(kept.map((v) => Math.abs(v - centre)));
  return { centre, isKept, count: kept.length, spreadMs };
}

function lineFit(xs: readonly number[], ys: readonly number[]): Line {
  const meanX = mean(xs);
  const meanY = mean(ys);
  const cov = xs.reduce(
    (sum, x, i) => sum + (x - meanX) * ((ys[i] ?? 0) - meanY),
    0,
  );
  const varX = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  const slope = varX > 0 ? cov / varX : Number.NaN;
  return { slope, intercept: meanY - slope * meanX };
}

function withoutDoubleTaps(taps: readonly number[], stepMs: number): number[] {
  return taps.reduce<number[]>((kept, t) => {
    const last = kept.at(-1);
    if (last === undefined || t - last >= stepMs / 2) kept.push(t);
    return kept;
  }, []);
}

function tappedBeat(songMsTaps: readonly number[]): TappedBeat | undefined {
  const taps = withoutDoubleTaps(songMsTaps, tapStep(songMsTaps));
  const step = tapStep(taps);
  if (!(step > 0)) return undefined;
  const reference = circularCentre(taps, step);
  const beats = taps.map((t) => Math.round((t - reference) / step));
  const rough = lineFit(beats, taps);
  const { isKept, count } = inliersNearMedian(
    taps.map((t, i) => t - rough.intercept - rough.slope * (beats[i] ?? 0)),
  );
  const { slope } = lineFit(
    beats.filter((_b, i) => isKept[i]),
    taps.filter((_t, i) => isKept[i]),
  );
  return slope > 0 ? { beatMs: slope, taps, keptCount: count } : undefined;
}

function songTempo(
  tappedMs: number,
  songBpm: number,
  denominator: number,
): TempoChoice {
  const beatMs = beatLengthMs(songBpm, denominator);
  const offs = TAPS_PER_SONG_BEAT.map((perBeat) =>
    Math.abs(tappedMs / (beatMs / perBeat) - 1),
  );
  const best = Math.min(...offs);
  const perBeat = TAPS_PER_SONG_BEAT[offs.indexOf(best)] ?? 1;
  if (best > TEMPO_DISAGREE_TOLERANCE)
    return { ok: false, reason: TAP_LOCK_MISS.disagrees };
  if (best > TEMPO_AGREE_TOLERANCE)
    return { ok: false, reason: TAP_LOCK_MISS.unsure };
  const tempo = {
    bpm: songBpm,
    beatMs,
    gridMs: beatMs / perBeat,
    beatSource: BEAT_SOURCE.song,
  };
  return { ok: true, tempo };
}

function tempoFor(
  tappedMs: number,
  tappedBpm: number,
  song: SongTempo,
): TempoChoice {
  if (tappedBpm < TEMPO_MIN_BPM || tappedBpm > TEMPO_MAX_BPM)
    return { ok: false, reason: TAP_LOCK_MISS.outOfRange };
  if (song.bpm !== null) return songTempo(tappedMs, song.bpm, song.denominator);
  const tempo = {
    bpm: tappedBpm,
    beatMs: tappedMs,
    gridMs: tappedMs,
    beatSource: BEAT_SOURCE.taps,
  };
  return { ok: true, tempo };
}

function phaseFit(taps: readonly number[], gridMs: number): PhaseFit {
  const reference = circularCentre(taps, gridMs);
  const offsets = taps.map((t) => t - nearest(t, reference, gridMs));
  const { centre, isKept, spreadMs } = inliersNearMedian(offsets);
  return {
    centreMs: reference + centre,
    keptTaps: taps.filter((_t, i) => isKept[i]),
    spreadMs,
  };
}

// People start tapping on a beat, so the first kept tap picks which half of
// double-time taps is the song's beat.
function anchorNearNewest(phase: PhaseFit, tempo: Tempo): number {
  const first = phase.keptTaps[0] ?? phase.centreMs;
  const newest = phase.keptTaps.at(-1) ?? first;
  const firstBeat = nearest(first, phase.centreMs, tempo.gridMs);
  return nearest(newest, firstBeat, tempo.beatMs);
}

const refused = (
  reason: TapLockMiss,
  tappedBpm: number | null,
  spreadMs: number | null = null,
): TapLockRefused => ({ locked: false, reason, spreadMs, tappedBpm });

function lockOn(
  tapped: TappedBeat,
  tempo: Tempo,
  tappedBpm: number,
): TapLockResult {
  const phase = phaseFit(tapped.taps, tempo.gridMs);
  if (
    phase.keptTaps.length < TAPS_TO_SET_TEMPO ||
    phase.spreadMs > TAP_AGREE_MS
  )
    return refused(TAP_LOCK_MISS.spread, tappedBpm, phase.spreadMs);
  return {
    locked: true,
    ...tempo,
    anchorMs: anchorNearNewest(phase, tempo),
    spreadMs: phase.spreadMs,
    keptTaps: phase.keptTaps.length,
  };
}

export function tapLock(
  songMsTaps: readonly number[],
  song: SongTempo,
): TapLockResult {
  const recent = songMsTaps.slice(-TAP_LOCK_WINDOW);
  const tapped =
    recent.length < TAPS_TO_SET_TEMPO ? undefined : tappedBeat(recent);
  if (tapped === undefined) return refused(TAP_LOCK_MISS.tooFew, null);
  const tappedBpm = bpmFromBeatMs(tapped.beatMs, song.denominator);
  if (tapped.keptCount < TAPS_TO_SET_TEMPO)
    return refused(TAP_LOCK_MISS.spread, tappedBpm);
  const choice = tempoFor(tapped.beatMs, tappedBpm, song);
  if (!choice.ok) return refused(choice.reason, tappedBpm);
  return lockOn(tapped, choice.tempo, tappedBpm);
}

export const downbeatForBeat = (
  grid: BeatGrid,
  beatsPerBar: number,
  beatIndex: number,
): number => grid.anchorMs + positiveMod(beatIndex, beatsPerBar) * grid.beatMs;

export const downbeatFromTap = (grid: BeatGrid, songMsTap: number): number =>
  nearest(songMsTap, grid.anchorMs, grid.gridMs);
