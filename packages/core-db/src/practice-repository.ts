import { count, eq, gt, sql, type SQL } from 'drizzle-orm';

import type { Database, DatabaseHandle } from './repository';
import { practiceSessions, setlists } from './schema';

export interface PracticeStats {
  readonly sessions: number;
  readonly totalSeconds: number;
  readonly avgBpm: number | null;
}

export interface NewPracticeSession {
  readonly uuid: string;
  readonly startedAt: Date;
  readonly durationSeconds: number;
  readonly avgBpm: number;
  readonly setlistId: number | null;
  readonly songUuids: readonly string[];
}

export interface PracticeRepository {
  stats(): Promise<PracticeStats>;
  insert(session: NewPracticeSession): Promise<void>;
}

const { durationSeconds, avgBpm } = practiceSessions;
const timed = gt(durationSeconds, 0);
const timedSum = (value: SQL) =>
  sql<number | null>`sum(case when ${timed} then ${value} end)`.mapWith(Number);

function encodeSongsPlayed(songUuids: readonly string[]): string | null {
  return songUuids.length === 0 ? null : JSON.stringify(songUuids);
}

async function existingSetlistId(
  db: Database,
  setlistId: number | null,
): Promise<number | null> {
  if (setlistId === null) return null;
  const [row] = await db
    .select({ id: setlists.id })
    .from(setlists)
    .where(eq(setlists.id, setlistId));
  return row?.id ?? null;
}

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
    insert: (session) =>
      transactor.serial(async () => {
        await db
          .insert(practiceSessions)
          .values({
            uuid: session.uuid,
            startTime: session.startedAt,
            durationSeconds: session.durationSeconds,
            avgBpm: session.avgBpm,
            setlistId: await existingSetlistId(db, session.setlistId),
            songsPlayed: encodeSongsPlayed(session.songUuids),
          })
          .onConflictDoNothing({ target: practiceSessions.uuid });
      }),
  };
}
