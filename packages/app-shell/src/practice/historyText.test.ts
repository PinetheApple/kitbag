import type { PracticeSessionListing } from '@kitbag/core-db';
import {
  groupSessions,
  HISTORY_GROUPING,
  historyGraph,
  type HistoryGrouping,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  deletedMessage,
  graphCaption,
  graphLabels,
  groupLabel,
  groupTotal,
  sessionRowText,
} from './historyText.ts';

const MINUTE = 60;
const NOW = new Date(2026, 10, 2, 20, 41);

function session(
  startedAt: Date,
  overrides: Partial<PracticeSessionListing> = {},
): PracticeSessionListing {
  return {
    uuid: startedAt.toISOString(),
    startedAt,
    durationSeconds: 42 * MINUTE + 18,
    avgBpm: 118.4,
    setlistId: 1,
    setlistName: 'Wedding set',
    songUuids: Array.from({ length: 8 }, (_, i) => String(i)),
    ...overrides,
  };
}

const blackbird = session(new Date(2026, 10, 2, 8, 5), {
  durationSeconds: 12 * MINUTE + 30,
  avgBpm: 96,
  setlistId: null,
  setlistName: null,
  songUuids: ['blackbird'],
});
const titles = {
  song: (uuid: string) => (uuid === 'blackbird' ? 'Blackbird' : undefined),
  setlist: (setlistId: number) =>
    setlistId === 7 ? 'Jazz standards' : undefined,
};

describe('session rows', () => {
  it.each<[HistoryGrouping, string, string]>([
    ['day', '19:40 · Wedding set', '8 songs · 118 BPM'],
    ['week', 'Today · 19:40', 'Wedding set · 8 songs · 118 BPM'],
    ['month', 'Today · 19:40', 'Wedding set · 8 songs · 118 BPM'],
  ])('under a %s header', (grouping, title, subtitle) => {
    const row = session(new Date(2026, 10, 2, 19, 40));
    expect(sessionRowText(row, grouping, NOW, titles)).toEqual({
      title,
      subtitle,
    });
  });

  it('names a single song and a click-only session', () => {
    expect(sessionRowText(blackbird, 'day', NOW, titles)).toEqual({
      title: '08:05 · Blackbird',
      subtitle: '96 BPM',
    });
    const click = { ...blackbird, songUuids: [], avgBpm: 80 };
    expect(sessionRowText(click, 'day', NOW, titles).title).toBe(
      '08:05 · Click only',
    );
  });

  it('keeps the weekday and date under weeks, weekday and day under months', () => {
    const row = session(new Date(2026, 9, 31, 21, 10));
    expect(sessionRowText(row, 'week', NOW, titles).title).toBe(
      'Sat 31 Oct · 21:10',
    );
    expect(sessionRowText(row, 'month', NOW, titles).title).toBe(
      'Sat 31 · 21:10',
    );
  });
});

describe('a session whose setlist name was not kept', () => {
  it('reads the name from the library by its setlist id', () => {
    const row = session(new Date(2026, 9, 29, 18, 30), {
      setlistId: 7,
      setlistName: null,
      songUuids: ['a', 'b', 'c', 'd'],
    });
    expect(sessionRowText(row, 'week', NOW, titles).subtitle).toBe(
      'Jazz standards · 4 songs · 118 BPM',
    );
  });
});

describe('group headers', () => {
  const rows = [
    session(new Date(2026, 10, 2, 19, 40)),
    blackbird,
    session(new Date(2026, 9, 31, 21, 10), { durationSeconds: 3940 }),
    session(new Date(2026, 9, 21, 7, 45)),
  ];

  it('labels each grouping as drawn', () => {
    const label = (grouping: HistoryGrouping) =>
      groupSessions(rows, grouping).map((g) =>
        groupLabel(g.start, grouping, NOW),
      );
    expect(label('day')).toEqual(['Today', 'Sat 31 Oct', 'Wed 21 Oct']);
    expect(label('week')).toEqual([
      'This week',
      '26 Oct – 1 Nov',
      '19 – 25 Oct',
    ]);
    expect(label('month')).toEqual(['November', 'October']);
  });

  it('counts sessions only when there are several', () => {
    const [today, saturday] = groupSessions(rows, HISTORY_GROUPING.day);
    if (today === undefined || saturday === undefined)
      throw new Error('groups');
    expect(groupTotal(today, 'day')).toBe('2 sessions · 54:48');
    expect(groupTotal(saturday, 'day')).toBe('1:05:40');
    const [thisWeek] = groupSessions(rows, HISTORY_GROUPING.week);
    if (thisWeek === undefined) throw new Error('groups');
    expect(groupTotal(thisWeek, 'week')).toBe('2 sessions · 55m');
  });

  it('names a month of another year with the year', () => {
    expect(groupLabel(new Date(2025, 11, 1), 'month', NOW)).toBe(
      'December 2025',
    );
  });
});

describe('graph text', () => {
  it('labels day bars by weekday, the last one now', () => {
    const bars = historyGraph([], 'day', NOW);
    expect(graphLabels(bars, 'day').join('')).toBe('TWTFSSMTWTFSSM');
  });

  it('labels every fourth week and the current one', () => {
    const labels = graphLabels(historyGraph([], 'week', NOW), 'week');
    expect(labels.filter((label) => label !== '')).toEqual([
      '17 Aug',
      '14 Sep',
      '12 Oct',
      '2 Nov',
    ]);
  });

  it('labels months by initial', () => {
    const labels = graphLabels(historyGraph([], 'month', NOW), 'month');
    expect(labels.join('')).toBe('DJFMAMJJASON');
  });

  it('writes out the largest bar', () => {
    const bars = historyGraph(
      [session(new Date(2026, 10, 1, 9), { durationSeconds: 66 * MINUTE })],
      'day',
      NOW,
    );
    expect(graphCaption(bars, 'day')).toBe(
      'Minutes a day · last 14 days · most 1 h 06 m',
    );
    expect(graphCaption(historyGraph([], 'week', NOW), 'week')).toBe(
      'Hours a week · last 12 weeks',
    );
  });

  it.each([
    ['week', 'Hours a week · last 12 weeks · most 0 h 01 m'],
    ['month', 'Hours a month · last 12 months · most 0 h 01 m'],
  ] as const)('writes the %s maximum in hours', (grouping, caption) => {
    const bars = historyGraph(
      [session(new Date(2026, 10, 1, 9), { durationSeconds: MINUTE })],
      grouping,
      NOW,
    );
    expect(graphCaption(bars, grouping)).toBe(caption);
  });

  it('writes a short day maximum in minutes', () => {
    const bars = historyGraph(
      [session(new Date(2026, 10, 1, 9), { durationSeconds: MINUTE })],
      'day',
      NOW,
    );
    expect(graphCaption(bars, 'day')).toBe(
      'Minutes a day · last 14 days · most 1 m',
    );
  });
});

describe('deletedMessage', () => {
  it('names the session by when it started', () => {
    expect(deletedMessage(blackbird, NOW)).toBe(
      'Session from today 08:05 deleted',
    );
    expect(deletedMessage(session(new Date(2026, 9, 31, 21, 10)), NOW)).toBe(
      'Session from Sat 31 Oct 21:10 deleted',
    );
  });
});
