import type { PracticeStats } from '@kitbag/core-db';
import {
  configurePracticeHistory,
  configurePracticeSessions,
  type PracticeHistoryRepository,
} from '@kitbag/core-state';

const NO_PRACTICE: PracticeStats = {
  sessions: 0,
  totalSeconds: 0,
  avgBpm: null,
};

const NO_HISTORY: PracticeHistoryRepository = {
  list: () => Promise.resolve([]),
  stats: () => Promise.resolve(NO_PRACTICE),
  get: () => Promise.resolve(undefined),
  delete: () => Promise.resolve(undefined),
  restore: () => Promise.resolve(),
};

export function readPracticeStats(): Promise<PracticeStats> {
  return Promise.resolve(NO_PRACTICE);
}

export function savePracticeSession(): Promise<void> {
  return Promise.resolve();
}

configurePracticeSessions({ insert: savePracticeSession });
configurePracticeHistory(() => NO_HISTORY);
