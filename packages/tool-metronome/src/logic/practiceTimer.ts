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

// The store holds one summary; while it waits, the newer session keeps running.
export function endPractice(
  sessions: PracticeSessions,
  resetClock: () => void,
): void {
  const { pending, endSession } = sessions.getState();
  if (pending !== null) return;
  endSession();
  resetClock();
}
