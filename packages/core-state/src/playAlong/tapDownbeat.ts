import { positiveMod } from '../metronome/config.ts';
import {
  downbeatForBeat,
  downbeatFromTap,
  type BeatGrid,
  type TapLocked,
} from './tapLock.ts';

export interface PickedOne {
  readonly downbeatMs: number;
  readonly movedBeats: number;
}

export const beatGrid = (anchorMs: number, beatMs: number): BeatGrid => ({
  anchorMs,
  beatMs,
  gridMs: beatMs,
});

export function firstTapDownbeatMs(
  grid: BeatGrid,
  firstTapMs: number,
  beatsPerBar: number,
): number {
  const beatsBack = Math.round((grid.anchorMs - firstTapMs) / grid.beatMs);
  return downbeatForBeat(grid, beatsPerBar, -beatsBack);
}

export function keptOneMs(
  oldDownbeatMs: number,
  barMs: number,
  grid: BeatGrid,
): number {
  const bars = Math.round((grid.anchorMs - oldDownbeatMs) / barMs);
  return downbeatFromTap(
    beatGrid(grid.anchorMs, grid.beatMs),
    oldDownbeatMs + bars * barMs,
  );
}

export function oneFromTap(
  downbeatMs: number,
  beatMs: number,
  tapMs: number,
  beatsPerBar: number,
): PickedOne {
  const snapped = downbeatFromTap(beatGrid(downbeatMs, beatMs), tapMs);
  const beats = Math.round((snapped - downbeatMs) / beatMs);
  return { downbeatMs: snapped, movedBeats: positiveMod(beats, beatsPerBar) };
}

const nearestBeat = (beats: readonly number[], sec: number): number =>
  beats.reduce(
    (best, beat, index) =>
      Math.abs(beat - sec) < Math.abs((beats[best] ?? beat) - sec)
        ? index
        : best,
    0,
  );

export function gridBeatsToOne(
  beats: readonly number[],
  downbeats: readonly number[],
  tapSec: number,
  beatsPerBar: number,
): number {
  const index = nearestBeat(beats, tapSec);
  const bar = downbeats.filter((d) => d <= index).at(-1) ?? downbeats[0];
  return positiveMod(index - (bar ?? index), beatsPerBar);
}

export const halfOrDoubleBpm = (lock: TapLocked): number | undefined =>
  lock.gridMs === lock.beatMs
    ? undefined
    : (lock.bpm * lock.beatMs) / lock.gridMs;
