import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatPracticeSummary,
  formatSessionCount,
} from './format.ts';

describe('formatDuration', () => {
  it.each([
    [0, '0m'],
    [59, '<1m'],
    [60, '1m'],
    [3599, '59m'],
    [3600, '1h 0m'],
    [66_000, '18h 20m'],
  ])('formats %d s as %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('formatSessionCount', () => {
  it.each([
    [1, '1 session'],
    [2, '2 sessions'],
    [34, '34 sessions'],
  ])('formats %d as %s', (sessions, text) => {
    expect(formatSessionCount(sessions)).toBe(text);
  });
});

describe('formatPracticeSummary', () => {
  it('splits the count from the muted detail', () => {
    expect(
      formatPracticeSummary({
        sessions: 34,
        totalSeconds: 66_000,
        avgBpm: 111.6,
      }),
    ).toEqual({ lead: '34 sessions', detail: '· 18h 20m · avg 112 BPM' });
  });

  it('drops the average when there is none', () => {
    expect(
      formatPracticeSummary({ sessions: 2, totalSeconds: 0, avgBpm: null }),
    ).toEqual({ lead: '2 sessions', detail: '· 0m' });
  });

  it('shows the empty state wholly muted', () => {
    expect(
      formatPracticeSummary({ sessions: 0, totalSeconds: 0, avgBpm: null }),
    ).toEqual({ lead: null, detail: 'No sessions yet' });
  });
});
