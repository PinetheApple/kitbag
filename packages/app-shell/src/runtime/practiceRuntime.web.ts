import type { PracticeStats } from '@kitbag/core-db';

const NO_PRACTICE: PracticeStats = {
  sessions: 0,
  totalSeconds: 0,
  avgBpm: null,
};

export function readPracticeStats(): Promise<PracticeStats> {
  return Promise.resolve(NO_PRACTICE);
}
