import type { PracticeSessionListing } from '@kitbag/core-db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  GRAPH_PERIODS,
  groupSessions,
  HISTORY_GROUPING,
  historyGraph,
  longestBar,
} from './history.ts';

const MINUTE = 60;

let zone: string | undefined;

function inZone(tz: string) {
  beforeEach(() => {
    zone = process.env.TZ;
    process.env.TZ = tz;
  });
  afterEach(() => {
    process.env.TZ = zone;
  });
}

function session(
  uuid: string,
  startedAt: Date,
  durationSeconds = 10 * MINUTE,
): PracticeSessionListing {
  return {
    uuid,
    startedAt,
    durationSeconds,
    avgBpm: 100,
    setlistId: null,
    setlistName: null,
    songUuids: [],
  };
}

const local = (...parts: [number, number, number, number?, number?]) =>
  new Date(parts[0], parts[1] - 1, parts[2], parts[3] ?? 0, parts[4] ?? 0);

const starts = (groups: readonly { readonly start: Date }[]) =>
  groups.map((group) => group.start.toString());

describe('groupSessions in a zone ahead of UTC', () => {
  inZone('Asia/Kolkata');

  it('puts a session just after local midnight on its local day', () => {
    const monday = session('a', local(2026, 11, 2, 0, 30));
    const sunday = session('b', local(2026, 11, 1, 23, 50));
    const groups = groupSessions([monday, sunday], HISTORY_GROUPING.day);
    expect(starts(groups)).toEqual([
      local(2026, 11, 2).toString(),
      local(2026, 11, 1).toString(),
    ]);
  });

  it('starts weeks on Monday', () => {
    const monday = session('a', local(2026, 11, 2, 0, 30));
    const sunday = session('b', local(2026, 11, 1, 23, 50));
    const saturday = session('c', local(2026, 10, 31, 21, 10));
    const groups = groupSessions(
      [monday, sunday, saturday],
      HISTORY_GROUPING.week,
    );
    expect(starts(groups)).toEqual([
      local(2026, 11, 2).toString(),
      local(2026, 10, 26).toString(),
    ]);
    expect(groups[1]?.sessions.map((s) => s.uuid)).toEqual(['b', 'c']);
  });

  it('sums each group and splits months on the local first', () => {
    const groups = groupSessions(
      [
        session('a', local(2026, 11, 1, 0, 5), 5 * MINUTE),
        session('b', local(2026, 10, 31, 23, 55), 7 * MINUTE),
        session('c', local(2026, 10, 2), 3 * MINUTE),
      ],
      HISTORY_GROUPING.month,
    );
    expect(groups.map((g) => [g.sessions.length, g.totalSeconds])).toEqual([
      [1, 5 * MINUTE],
      [2, 10 * MINUTE],
    ]);
  });
});

describe('historyGraph', () => {
  inZone('Europe/London');

  it.each(Object.values(HISTORY_GROUPING))(
    'draws the fixed number of %s bars, ending on the current one',
    (grouping) => {
      const bars = historyGraph([], grouping, local(2026, 11, 2, 20, 41));
      expect(bars).toHaveLength(GRAPH_PERIODS[grouping]);
      expect(bars.map((bar) => bar.current)).toEqual([
        ...Array<boolean>(GRAPH_PERIODS[grouping] - 1).fill(false),
        true,
      ]);
    },
  );

  it('keeps every day bar on local midnight across the clocks going back', () => {
    const bars = historyGraph([], HISTORY_GROUPING.day, local(2026, 11, 2, 9));
    expect(bars[0]?.start.toString()).toBe(local(2026, 10, 20).toString());
    expect(bars.every((bar) => bar.start.getHours() === 0)).toBe(true);
    expect(new Set(bars.map((bar) => bar.start.getDate())).size).toBe(14);
  });

  it('adds each session into its period and leaves older ones out', () => {
    const now = local(2026, 11, 2, 20, 41);
    const bars = historyGraph(
      [
        session('a', local(2026, 11, 2, 19, 40), 42 * MINUTE),
        session('b', local(2026, 11, 2, 8, 5), 12 * MINUTE),
        session('c', local(2026, 10, 25, 23, 30), 20 * MINUTE),
        session('d', local(2026, 10, 1), 99 * MINUTE),
      ],
      HISTORY_GROUPING.day,
      now,
    );
    expect(bars.at(-1)?.seconds).toBe(54 * MINUTE);
    expect(bars.at(-9)?.seconds).toBe(20 * MINUTE);
    expect(longestBar(bars)).toBe(54 * MINUTE);
  });

  it('starts week bars on Mondays and month bars on the first', () => {
    const now = local(2026, 11, 2, 20, 41);
    const weeks = historyGraph([], HISTORY_GROUPING.week, now);
    const months = historyGraph([], HISTORY_GROUPING.month, now);
    expect(weeks.every((bar) => bar.start.getDay() === 1)).toBe(true);
    expect(weeks[0]?.start.toString()).toBe(local(2026, 8, 17).toString());
    expect(months[0]?.start.toString()).toBe(local(2025, 12, 1).toString());
  });
});
