import type { LyricLineTimes, StoredLyrics } from '@kitbag/core-db';

import { parseLrc, plainLyricTexts, type LyricLine } from './lrc.ts';
import { lastAtOrBefore, NOT_FOUND } from './search.ts';

export const NO_LINE = NOT_FOUND;
export const RETIME_SHIFT_STEP_SEC = 0.1;
// Sorts after every real time, so lyricLineAt never reaches an untapped line.
const UNTIMED = Infinity;

export interface SongLyrics {
  readonly lines: readonly LyricLine[];
  readonly bundledTimes: readonly number[];
  readonly plain: string | null;
  readonly instrumental: boolean;
  readonly synced: boolean;
  readonly retimed: boolean;
}

export const NO_LYRICS: SongLyrics = {
  lines: [],
  bundledTimes: [],
  plain: null,
  instrumental: false,
  synced: false,
  retimed: false,
};

export interface RetimeTap {
  readonly line: number;
  readonly timeSec: number;
}

export interface RetimeTake {
  readonly taps: readonly RetimeTap[];
  readonly nextLine: number;
}

function inOrder(times: readonly number[]): boolean {
  return times.every((time, i) => time >= (times[i - 1] ?? time));
}

export function hasRealTime(times: readonly number[]): boolean {
  return times.some((time) => time !== UNTIMED);
}

function bundledLines(stored: StoredLyrics): LyricLine[] {
  const { synced, plain, offsetSec, instrumental } = stored;
  if (instrumental) return [];
  const parsed = synced === null ? [] : parseLrc(synced);
  if (parsed.length > 0)
    return parsed.map((line) => ({
      ...line,
      timeSec: line.timeSec + offsetSec,
    }));
  return plain === null
    ? []
    : plainLyricTexts(plain).map((text) => ({ timeSec: UNTIMED, text }));
}

function fitsLines(times: LyricLineTimes, bundled: readonly number[]) {
  const countFits = hasRealTime(bundled)
    ? times.length === bundled.length
    : times.length > 0 && times.length <= bundled.length;
  return countFits && inOrder(times);
}

export function withTimes(
  lines: readonly LyricLine[],
  times: readonly number[],
): LyricLine[] {
  return lines.map((line, i) => ({
    ...line,
    timeSec: times[i] ?? line.timeSec,
  }));
}

export function songLyrics(
  stored: StoredLyrics | null,
  retimed: LyricLineTimes | null,
): SongLyrics {
  if (stored === null) return NO_LYRICS;
  const base = bundledLines(stored);
  const bundledTimes = base.map((line) => line.timeSec);
  const usable = retimed !== null && fitsLines(retimed, bundledTimes);
  return {
    lines: withTimes(base, usable ? retimed : bundledTimes),
    bundledTimes,
    plain: stored.plain,
    instrumental: stored.instrumental,
    synced: usable || hasRealTime(bundledTimes),
    retimed: usable,
  };
}

export function lyricLineAt(
  lines: readonly LyricLine[],
  songSec: number,
): number {
  'worklet';
  return lastAtOrBefore(lines, 'timeSec', songSec);
}

export function isSungLine(line: LyricLine): boolean {
  return line.text !== '';
}

export function nextSungLine(
  lines: readonly LyricLine[],
  from: number,
): number {
  for (let i = Math.max(0, from); i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && isSungLine(line)) return i;
  }
  return NO_LINE;
}

// Earlier untimed lines would break the sort, so a session cannot start past one.
export function firstRetimeLine(
  lines: readonly LyricLine[],
  from: number,
): number {
  const untimed = lines.findIndex((line) => line.timeSec === UNTIMED);
  return nextSungLine(
    lines,
    untimed === NOT_FOUND ? from : Math.min(from, untimed),
  );
}

function previousSungLine(
  lines: readonly LyricLine[],
  from: number,
): LyricLine | undefined {
  for (let i = from - 1; i >= 0; i--) {
    const line = lines[i];
    if (line !== undefined && isSungLine(line)) return line;
  }
  return undefined;
}

// Lines before the first pin clamp down to it, so an earlier tap moves the take.
function anchoredLine(
  lines: readonly LyricLine[],
  line: number,
  timeSec: number,
): number {
  const before = previousSungLine(lines, line);
  if (before === undefined || timeSec > before.timeSec) return line;
  return firstRetimeLine(lines, Math.max(lyricLineAt(lines, timeSec), 0));
}

export function takeAfterTap(
  lines: readonly LyricLine[],
  { taps, nextLine }: RetimeTake,
  timeSec: number,
): RetimeTake | null {
  const redoFrom = taps.findIndex((tap) => tap.timeSec >= timeSec);
  const tapped = taps[redoFrom]?.line ?? nextLine;
  if (tapped === NO_LINE) return null;
  const kept = redoFrom === NOT_FOUND ? taps : taps.slice(0, redoFrom);
  const line =
    kept.length === 0 ? anchoredLine(lines, tapped, timeSec) : tapped;
  return {
    taps: [...kept, { line, timeSec }],
    nextLine: nextSungLine(lines, line + 1),
  };
}

function shiftedAfterTaps(
  lines: readonly LyricLine[],
  pinned: ReadonlyMap<number, number>,
): number[] {
  let shift = 0;
  return lines.map((line, i) => {
    const tapped = pinned.get(i);
    if (tapped === undefined) return line.timeSec + shift;
    if (line.timeSec !== UNTIMED) shift = tapped - line.timeSec;
    return tapped;
  });
}

// Sorted because lyricLineAt binary-searches these.
function orderedBetweenPins(
  times: readonly number[],
  pinned: ReadonlyMap<number, number>,
): number[] {
  const ceilings: number[] = [];
  let ceiling = Infinity;
  for (let i = times.length - 1; i >= 0; i--) {
    ceiling = pinned.get(i) ?? ceiling;
    ceilings[i] = ceiling;
  }
  let floor = -Infinity;
  return times.map((time, i) => {
    const placed = pinned.has(i)
      ? time
      : Math.min(Math.max(time, floor), ceilings[i] ?? Infinity);
    floor = placed;
    return placed;
  });
}

export function retimedTimes(
  lines: readonly LyricLine[],
  taps: readonly RetimeTap[],
): number[] {
  const pinned = new Map(taps.map((tap) => [tap.line, tap.timeSec]));
  return orderedBetweenPins(shiftedAfterTaps(lines, pinned), pinned);
}

export function shiftedTimes(
  times: readonly number[],
  steps: number,
): readonly number[] {
  if (steps === 0) return times;
  return times.map((time) => Math.max(0, time + steps * RETIME_SHIFT_STEP_SEC));
}

export function timedOnly(times: readonly number[]): number[] {
  return times.filter((time) => time !== UNTIMED);
}
