import {
  formatClockSeconds,
  type PracticeSessionStore,
} from '@kitbag/core-state';

const MS_PER_SECOND = 1000;

export interface PracticeSessions {
  readonly getState: () => PracticeSessionStore;
}

export function formatPracticeElapsed(elapsedMs: number): string {
  return formatClockSeconds(elapsedMs / MS_PER_SECOND);
}

export function hasPracticeToEnd(elapsedMs: number): boolean {
  return Math.floor(elapsedMs / MS_PER_SECOND) > 0;
}

export function endPractice(
  sessions: PracticeSessions,
  resetClock: () => void,
): void {
  sessions.getState().endSession();
  resetClock();
}
