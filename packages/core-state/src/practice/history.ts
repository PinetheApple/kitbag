import type { PracticeSessionListing } from '@kitbag/core-db';

export const HISTORY_GROUPING = {
  day: 'day',
  week: 'week',
  month: 'month',
} as const;

export type HistoryGrouping =
  (typeof HISTORY_GROUPING)[keyof typeof HISTORY_GROUPING];

export const HISTORY_GROUPINGS: readonly HistoryGrouping[] =
  Object.values(HISTORY_GROUPING);

export const DEFAULT_HISTORY_GROUPING: HistoryGrouping = HISTORY_GROUPING.day;

export const GRAPH_PERIODS: Readonly<Record<HistoryGrouping, number>> = {
  day: 14,
  week: 12,
  month: 12,
};

const DAYS_PER_WEEK = 7;
const MONDAY_OFFSET = 6;

export function isHistoryGrouping(value: unknown): value is HistoryGrouping {
  return HISTORY_GROUPINGS.some((grouping) => grouping === value);
}

export function periodStart(at: Date, grouping: HistoryGrouping): Date {
  const year = at.getFullYear();
  const month = at.getMonth();
  const day = at.getDate();
  if (grouping === HISTORY_GROUPING.month) return new Date(year, month, 1);
  if (grouping === HISTORY_GROUPING.day) return new Date(year, month, day);
  const sinceMonday = (at.getDay() + MONDAY_OFFSET) % DAYS_PER_WEEK;
  return new Date(year, month, day - sinceMonday);
}

export function periodAfter(
  start: Date,
  grouping: HistoryGrouping,
  periods: number,
): Date {
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  if (grouping === HISTORY_GROUPING.month)
    return new Date(year, month + periods, 1);
  const days =
    grouping === HISTORY_GROUPING.week ? periods * DAYS_PER_WEEK : periods;
  return new Date(year, month, day + days);
}

export interface HistoryGroup {
  readonly start: Date;
  readonly sessions: readonly PracticeSessionListing[];
  readonly totalSeconds: number;
}

export function groupSessions(
  listings: readonly PracticeSessionListing[],
  grouping: HistoryGrouping,
): readonly HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const session of listings) {
    const start = periodStart(session.startedAt, grouping);
    const last = groups.at(-1);
    if (last?.start.getTime() === start.getTime()) {
      groups[groups.length - 1] = {
        start,
        sessions: [...last.sessions, session],
        totalSeconds: last.totalSeconds + session.durationSeconds,
      };
    } else {
      groups.push({
        start,
        sessions: [session],
        totalSeconds: session.durationSeconds,
      });
    }
  }
  return groups;
}

export interface GraphBar {
  readonly start: Date;
  readonly seconds: number;
  readonly current: boolean;
}

export function historyGraph(
  listings: readonly PracticeSessionListing[],
  grouping: HistoryGrouping,
  now: Date,
): readonly GraphBar[] {
  const periods = GRAPH_PERIODS[grouping];
  const current = periodStart(now, grouping);
  const first = periodAfter(current, grouping, 1 - periods);
  const totals = new Map<number, number>();
  for (const session of listings) {
    const key = periodStart(session.startedAt, grouping).getTime();
    totals.set(key, (totals.get(key) ?? 0) + session.durationSeconds);
  }
  return Array.from({ length: periods }, (_, index) => {
    const start = periodAfter(first, grouping, index);
    return {
      start,
      seconds: totals.get(start.getTime()) ?? 0,
      current: index === periods - 1,
    };
  });
}

export function longestBar(bars: readonly GraphBar[]): number {
  return bars.reduce((most, bar) => Math.max(most, bar.seconds), 0);
}
