import type { RetimedLyrics, StoredLyrics } from '@kitbag/core-db';

import { parseLrc, type LyricLine } from './lrc.ts';
import { lastAtOrBefore } from './search.ts';

export const NO_LINE = -1;

export interface SongLyrics {
  readonly lines: readonly LyricLine[];
  readonly bundled: readonly number[];
  readonly plain: string | null;
  readonly instrumental: boolean;
  readonly retimed: boolean;
}

export const NO_LYRICS: SongLyrics = {
  lines: [],
  bundled: [],
  plain: null,
  instrumental: false,
  retimed: false,
};

export interface RetimeTap {
  readonly line: number;
  readonly timeSec: number;
}

function inOrder(times: readonly number[]): boolean {
  return times.every((time, i) => i === 0 || time >= (times[i - 1] ?? time));
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
  retimed: RetimedLyrics | null,
): SongLyrics {
  if (stored === null) return NO_LYRICS;
  const { synced, plain, offsetSec, instrumental } = stored;
  const parsed = synced === null || instrumental ? [] : parseLrc(synced);
  const bundled = parsed.map((line) => line.timeSec + offsetSec);
  const usable =
    retimed !== null && retimed.length === parsed.length && inOrder(retimed);
  return {
    lines: withTimes(parsed, usable ? retimed : bundled),
    bundled,
    plain,
    instrumental,
    retimed: usable,
  };
}

// Lines and times are song time, so the lookup holds at any playback speed.
export function lyricLineAt(
  lines: readonly LyricLine[],
  songSec: number,
): number {
  'worklet';
  return lastAtOrBefore(lines, 'timeSec', songSec);
}

export function nextSungLine(
  lines: readonly LyricLine[],
  from: number,
): number {
  for (let i = Math.max(0, from); i < lines.length; i++)
    if (lines[i]?.text !== '') return i;
  return NO_LINE;
}

// Taps pin their lines; each later line moves with the tap before it, then is
// clamped between its neighbours so the times stay sorted for the lookup.
export function retimedTimes(
  lines: readonly LyricLine[],
  taps: readonly RetimeTap[],
): number[] {
  const pinned = new Map(taps.map((tap) => [tap.line, tap.timeSec]));
  let shift = 0;
  const moved = lines.map((line, i) => {
    const tapped = pinned.get(i);
    if (tapped === undefined) return line.timeSec + shift;
    shift = tapped - line.timeSec;
    return tapped;
  });
  const ceilings: number[] = [];
  let ceiling = Infinity;
  for (let i = moved.length - 1; i >= 0; i--) {
    ceiling = pinned.get(i) ?? ceiling;
    ceilings[i] = ceiling;
  }
  let floor = -Infinity;
  return moved.map((time, i) => {
    const placed = pinned.has(i)
      ? time
      : Math.min(Math.max(time, floor), ceilings[i] ?? Infinity);
    floor = placed;
    return placed;
  });
}
