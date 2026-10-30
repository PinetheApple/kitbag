import type { PracticeStats } from '@kitbag/core-db';

import { getDatabase } from '@/runtime/database';

export function readPracticeStats(): Promise<PracticeStats> {
  return getDatabase().practice.stats();
}
