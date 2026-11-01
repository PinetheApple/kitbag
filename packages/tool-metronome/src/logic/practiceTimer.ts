import { formatClockSeconds } from '@kitbag/core-state';

const MS_PER_SECOND = 1000;

export function formatPracticeElapsed(elapsedMs: number): string {
  return formatClockSeconds(elapsedMs / MS_PER_SECOND);
}

export function hasPracticeToEnd(elapsedMs: number): boolean {
  return Math.floor(elapsedMs / MS_PER_SECOND) > 0;
}
