import { count, gt, sql } from 'drizzle-orm';

import type { DatabaseHandle } from './repository';
import { practiceSessions } from './schema';

export interface PracticeStats {
  readonly sessions: number;
  readonly totalSeconds: number;
  readonly avgBpm: number | null;
}

export interface PracticeRepository {
  stats(): Promise<PracticeStats>;
}

const { durationSeconds, avgBpm } = practiceSessions;
const timed = gt(durationSeconds, 0);

export function createPracticeRepository({
  db,
  transactor,
}: DatabaseHandle): PracticeRepository {
  return {
    stats: () =>
      transactor.serial(async () => {
        const [row] = await db
          .select({
            sessions: count(),
            totalSeconds: sql`coalesce(sum(${durationSeconds}), 0)`.mapWith(
              Number,
            ),
            weightedBpm: sql`sum(case when ${timed} then ${avgBpm} * ${durationSeconds} end)`,
            timedSeconds: sql`sum(case when ${timed} then ${durationSeconds} end)`,
          })
          .from(practiceSessions);
        const weightedBpm = Number(row?.weightedBpm ?? 0);
        const timedSeconds = Number(row?.timedSeconds ?? 0);
        return {
          sessions: row?.sessions ?? 0,
          totalSeconds: row?.totalSeconds ?? 0,
          avgBpm: timedSeconds > 0 ? weightedBpm / timedSeconds : null,
        };
      }),
  };
}
