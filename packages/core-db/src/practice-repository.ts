import { count, desc, eq, gt, sql, type SQL } from 'drizzle-orm';

import {
  encodePracticeLog,
  parsePracticeLog,
  type PracticeLog,
} from './practice-log';
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
  readonly setlistName: string | null;
  readonly songUuids: readonly string[];
  readonly log: PracticeLog | null;
}

export type SavedPracticeSession = NewPracticeSession;

export type PracticeSessionListing = Omit<SavedPracticeSession, 'log'>;

export interface PracticeRepository {
  stats(): Promise<PracticeStats>;
  insert(session: NewPracticeSession): Promise<void>;
  list(): Promise<PracticeSessionListing[]>;
  get(uuid: string): Promise<SavedPracticeSession | undefined>;
  delete(uuid: string): Promise<SavedPracticeSession | undefined>;
}

const { durationSeconds, avgBpm } = practiceSessions;
const timed = gt(durationSeconds, 0);
const timedSum = (value: SQL) =>
  sql<number | null>`sum(case when ${timed} then ${value} end)`.mapWith(Number);

const LISTED = {
  uuid: practiceSessions.uuid,
  startTime: practiceSessions.startTime,
  durationSeconds,
  avgBpm,
  setlistId: practiceSessions.setlistId,
  setlistName: practiceSessions.setlistName,
  songsPlayed: practiceSessions.songsPlayed,
};

function encodeSongsPlayed(songUuids: readonly string[]): string | null {
  return songUuids.length === 0 ? null : JSON.stringify(songUuids);
}

function decodeSongsPlayed(text: string | null): string[] {
  if (text === null) return [];
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value)
      ? value.filter((uuid): uuid is string => typeof uuid === 'string')
      : [];
  } catch {
    return [];
  }
}

type ListedRow = Pick<
  typeof practiceSessions.$inferSelect,
  keyof typeof LISTED
>;

function listingOf(row: ListedRow): PracticeSessionListing {
  return {
    uuid: row.uuid,
    startedAt: row.startTime,
    durationSeconds: row.durationSeconds,
    avgBpm: row.avgBpm,
    setlistId: row.setlistId,
    setlistName: row.setlistName,
    songUuids: decodeSongsPlayed(row.songsPlayed),
  };
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

async function find(
  db: Database,
  uuid: string,
): Promise<SavedPracticeSession | undefined> {
  const [row] = await db
    .select()
    .from(practiceSessions)
    .where(eq(practiceSessions.uuid, uuid));
  return row === undefined
    ? undefined
    : { ...listingOf(row), log: parsePracticeLog(row.log) };
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
            setlistName: session.setlistName,
            songsPlayed: encodeSongsPlayed(session.songUuids),
            log: encodePracticeLog(session.log),
          })
          .onConflictDoNothing({ target: practiceSessions.uuid });
      }),
    list: () =>
      transactor.serial(async () => {
        const rows = await db
          .select(LISTED)
          .from(practiceSessions)
          .orderBy(desc(practiceSessions.startTime), desc(practiceSessions.id));
        return rows.map(listingOf);
      }),
    get: (uuid) => transactor.serial(() => find(db, uuid)),
    delete: (uuid) =>
      transactor.serial(async () => {
        const saved = await find(db, uuid);
        if (saved !== undefined)
          await db
            .delete(practiceSessions)
            .where(eq(practiceSessions.uuid, uuid));
        return saved;
      }),
  };
}
