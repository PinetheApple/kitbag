import { formatClockSeconds } from '../text.ts';

export function framesToSeconds(frames: number, engineRate: number): number {
  'worklet';
  return engineRate > 0 ? frames / engineRate : 0;
}

export function secondsToFrames(seconds: number, engineRate: number): number {
  return Math.round(seconds * engineRate);
}

export function formatClock(frames: number, engineRate: number): string {
  'worklet';
  return formatClockSeconds(framesToSeconds(frames, engineRate));
}
