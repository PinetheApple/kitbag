import { MS_PER_SECOND } from '@kitbag/core-db';

export function msToNextWholeSecond(sinceMs: number, nowMs: number): number {
  const into =
    (((nowMs - sinceMs) % MS_PER_SECOND) + MS_PER_SECOND) % MS_PER_SECOND;
  return MS_PER_SECOND - into;
}
