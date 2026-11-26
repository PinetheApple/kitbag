import { withinBpmBounds } from '../metronome/config.ts';

const HALF_TIME = 0.5;
const DOUBLE_TIME = 2;

export function halvedBpm(bpm: number): number {
  return withinBpmBounds(bpm * HALF_TIME);
}

export function doubledBpm(bpm: number): number {
  return withinBpmBounds(bpm * DOUBLE_TIME);
}
