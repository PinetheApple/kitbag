import type { PracticeStats } from '@kitbag/core-db';

import { getDatabase } from './database';

export async function readPracticeStats(): Promise<PracticeStats> {
  return getDatabase().practice.stats();
}
