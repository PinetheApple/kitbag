import type { NewPracticeSession, PracticeStats } from '@kitbag/core-db';
import { configurePracticeSessions } from '@kitbag/core-state';

import { getDatabase } from './database';

export async function readPracticeStats(): Promise<PracticeStats> {
  return getDatabase().practice.stats();
}

export async function savePracticeSession(
  session: NewPracticeSession,
): Promise<void> {
  return getDatabase().practice.insert(session);
}

configurePracticeSessions({ insert: savePracticeSession });
