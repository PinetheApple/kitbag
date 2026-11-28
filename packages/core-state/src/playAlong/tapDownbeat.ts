import { positiveMod } from '../metronome/config.ts';
import {
  downbeatForBeat,
  downbeatFromTap,
  type BeatGrid,
  type TapLocked,
} from './tapLock.ts';

const beatGrid = (anchorMs: number, beatMs: number): BeatGrid => ({
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

export function beatsToOne(
  clickDownbeatMs: number,
  beatMs: number,
  tapMs: number,
  beatsPerBar: number,
): number {
  const snapped = downbeatFromTap(beatGrid(clickDownbeatMs, beatMs), tapMs);
  return positiveMod(
    Math.round((snapped - clickDownbeatMs) / beatMs),
    beatsPerBar,
  );
}

export const songGrid = (anchorMs: number, beatMs: number): BeatGrid =>
  beatGrid(anchorMs, beatMs);

export const halfOrDoubleBpm = (lock: TapLocked): number | undefined =>
  lock.gridMs === lock.beatMs
    ? undefined
    : (lock.bpm * lock.beatMs) / lock.gridMs;
