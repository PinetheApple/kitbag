import { count, gt, sql, type SQL } from 'drizzle-orm';

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
const timedSum = (value: SQL) =>
  sql<number | null>`sum(case when ${timed} then ${value} end)`.mapWith(Number);

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
            weightedBpm: timedSum(sql`${avgBpm} * ${durationSeconds}`),
            timedSeconds: timedSum(sql`${durationSeconds}`),
          })
          .from(practiceSessions);
        const weightedBpm = row?.weightedBpm ?? 0;
        const timedSeconds = row?.timedSeconds ?? 0;
        return {
          sessions: row?.sessions ?? 0,
          totalSeconds: row?.totalSeconds ?? 0,
          avgBpm: timedSeconds > 0 ? weightedBpm / timedSeconds : null,
        };
      }),
  };
}
