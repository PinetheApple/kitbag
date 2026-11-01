import type { PracticeStats } from '@kitbag/core-db';
import { configurePracticeSessions } from '@kitbag/core-state';

const NO_PRACTICE: PracticeStats = {
  sessions: 0,
  totalSeconds: 0,
  avgBpm: null,
};

export function readPracticeStats(): Promise<PracticeStats> {
  return Promise.resolve(NO_PRACTICE);
}

export function savePracticeSession(): Promise<void> {
  return Promise.resolve();
}

configurePracticeSessions({ insert: savePracticeSession });
