// Practice pill clock (SPEC §5.2: "practice timer pill under the app bar, tap
// to reset"). Formatting only — the pill ticks once a second, which is
// human-speed React state, not a 60fps value (§13.3).

import { formatClockSeconds } from '@kitbag/core-state';

const MS_PER_SECOND = 1000;

export function formatPracticeElapsed(elapsedMs: number): string {
  return formatClockSeconds(elapsedMs / MS_PER_SECOND);
}

/** The pill offers reset only once it reads past 0:00 — the same flooring as
 * the clock, so "reset" never sits beside a timer showing nothing to reset. */
export function hasPracticeToReset(elapsedMs: number): boolean {
  return Math.floor(elapsedMs / MS_PER_SECOND) > 0;
}
