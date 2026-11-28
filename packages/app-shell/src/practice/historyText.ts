import type { PracticeSessionListing } from '@kitbag/core-db';
import { countLabel } from '@kitbag/core-design';
import {
  clockParts,
  clockTime,
  formatClockSeconds,
  HISTORY_GROUPING,
  longestBar,
  pad,
  periodStart,
  SECONDS_PER_MINUTE,
  type GraphBar,
  type HistoryGroup,
  type HistoryGrouping,
} from '@kitbag/core-state';

import { formatDuration } from '../settings/practiceText.ts';
import { SEPARATOR } from '../settings/separator.ts';
import {
  dayMonth,
  daysBetween,
  fullMonthName,
  initial,
  monthName,
  weekdayDate,
  weekdayName,
} from '../dates.ts';

const WEEK_LABEL_EVERY = 4;
const LAST_DAY_OF_WEEK = 6;
export const CLICK_ONLY = 'Click only';
const DASH = '–';

export type SongTitle = (uuid: string) => string | undefined;

export interface SessionNames {
  readonly song: SongTitle;
  readonly setlist: (setlistId: number) => string | undefined;
}

type Named = Pick<
  PracticeSessionListing,
  'setlistId' | 'setlistName' | 'songUuids'
>;

function setlistNameOf(session: Named, names: SessionNames): string | null {
  if (session.setlistName !== null) return session.setlistName;
  if (session.setlistId === null) return null;
  return names.setlist(session.setlistId) ?? null;
}

const join = (parts: readonly string[]) => parts.join(` ${SEPARATOR} `);

function isCurrent(start: Date, grouping: HistoryGrouping, now: Date) {
  return periodStart(now, grouping).getTime() === start.getTime();
}

function weekRange(start: Date): string {
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + LAST_DAY_OF_WEEK,
  );
  const from =
    start.getMonth() === end.getMonth()
      ? String(start.getDate())
      : dayMonth(start);
  return `${from} ${DASH} ${dayMonth(end)}`;
}

export function groupLabel(
  start: Date,
  grouping: HistoryGrouping,
  now: Date,
): string {
  const current = isCurrent(start, grouping, now);
  if (grouping === HISTORY_GROUPING.day)
    return current ? 'Today' : weekdayDate(start);
  if (grouping === HISTORY_GROUPING.week)
    return current ? 'This week' : weekRange(start);
  const month = fullMonthName(start);
  return start.getFullYear() === now.getFullYear()
    ? month
    : `${month} ${String(start.getFullYear())}`;
}

export function groupTotal(
  group: HistoryGroup,
  grouping: HistoryGrouping,
): string {
  const length =
    grouping === HISTORY_GROUPING.day
      ? formatClockSeconds(group.totalSeconds)
      : formatDuration(group.totalSeconds);
  const count = group.sessions.length;
  if (count === 1) return length;
  return join([countLabel(count, 'session', 'sessions'), length]);
}

export function sessionName(session: Named, names: SessionNames): string {
  const setlist = setlistNameOf(session, names);
  if (setlist !== null) return setlist;
  const [only, ...more] = session.songUuids;
  if (only === undefined) return CLICK_ONLY;
  if (more.length > 0)
    return countLabel(session.songUuids.length, 'song', 'songs');
  return names.song(only) ?? countLabel(1, 'song', 'songs');
}

export function bpmText(bpm: number): string {
  return `${String(Math.round(bpm))} BPM`;
}

function sessionFacts(
  session: PracticeSessionListing,
  names: SessionNames,
): string[] {
  const songs =
    setlistNameOf(session, names) === null
      ? []
      : [countLabel(session.songUuids.length, 'song', 'songs')];
  return [...songs, bpmText(session.avgBpm)];
}

function rowWhen(at: Date, grouping: HistoryGrouping, now: Date): string {
  const time = clockTime(at);
  if (daysBetween(at, now) === 0) return join(['Today', time]);
  const day =
    grouping === HISTORY_GROUPING.month
      ? `${weekdayName(at)} ${String(at.getDate())}`
      : weekdayDate(at);
  return join([day, time]);
}

export interface RowText {
  readonly title: string;
  readonly subtitle: string;
}

export function sessionRowText(
  session: PracticeSessionListing,
  grouping: HistoryGrouping,
  now: Date,
  names: SessionNames,
): RowText {
  const name = sessionName(session, names);
  const facts = sessionFacts(session, names);
  if (grouping === HISTORY_GROUPING.day)
    return {
      title: join([clockTime(session.startedAt), name]),
      subtitle: join(facts),
    };
  return {
    title: rowWhen(session.startedAt, grouping, now),
    subtitle: join([name, ...facts]),
  };
}

export function sessionLength(session: PracticeSessionListing): string {
  return formatClockSeconds(session.durationSeconds);
}

function barLabel(bar: GraphBar, index: number, grouping: HistoryGrouping) {
  if (grouping === HISTORY_GROUPING.day) return initial(weekdayName(bar.start));
  if (grouping === HISTORY_GROUPING.month) return initial(monthName(bar.start));
  return bar.current || index % WEEK_LABEL_EVERY === 0
    ? dayMonth(bar.start)
    : '';
}

export function graphLabels(
  bars: readonly GraphBar[],
  grouping: HistoryGrouping,
): readonly string[] {
  return bars.map((bar, index) => barLabel(bar, index, grouping));
}

const GRAPH_CAPTION: Readonly<Record<HistoryGrouping, string>> = {
  day: 'Minutes a day',
  week: 'Hours a week',
  month: 'Hours a month',
};

const GRAPH_SPAN: Readonly<Record<HistoryGrouping, string>> = {
  day: 'days',
  week: 'weeks',
  month: 'months',
};

const GRAPH_IN_HOURS: Readonly<Record<HistoryGrouping, boolean>> = {
  day: false,
  week: true,
  month: true,
};

function mostText(seconds: number, grouping: HistoryGrouping): string {
  const { hours, minutes } = clockParts(seconds);
  if (hours === 0 && !GRAPH_IN_HOURS[grouping]) return `${String(minutes)} m`;
  return `${String(hours)} h ${pad(minutes)} m`;
}

export function graphCaption(
  bars: readonly GraphBar[],
  grouping: HistoryGrouping,
): string {
  const span = `last ${String(bars.length)} ${GRAPH_SPAN[grouping]}`;
  const most = longestBar(bars);
  const parts = [GRAPH_CAPTION[grouping], span];
  if (most >= SECONDS_PER_MINUTE)
    parts.push(`most ${mostText(most, grouping)}`);
  return join(parts);
}

export function deletedMessage(session: PracticeSessionListing, now: Date) {
  const at = session.startedAt;
  const day = daysBetween(at, now) === 0 ? 'today' : weekdayDate(at);
  return `Session from ${day} ${clockTime(at)} deleted`;
}
