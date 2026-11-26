import { BPM_BOUNDS, clamp } from '../metronome/config.ts';

const HALF_TIME = 0.5;
const DOUBLE_TIME = 2;

export function withinBpmBounds(bpm: number): number {
  return clamp(bpm, BPM_BOUNDS.min, BPM_BOUNDS.max);
}

export function halvedBpm(bpm: number): number {
  return withinBpmBounds(bpm * HALF_TIME);
}

export function doubledBpm(bpm: number): number {
  return withinBpmBounds(bpm * DOUBLE_TIME);
}
