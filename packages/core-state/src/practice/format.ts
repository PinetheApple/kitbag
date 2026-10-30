import type { PracticeStats } from '@kitbag/core-db';

import { clockParts } from '../text.ts';

const SECONDS_PER_MINUTE = 60;
const SEPARATOR = '·';
const EMPTY_PRACTICE = 'No sessions yet';

export interface PracticeSummary {
  readonly lead: string | null;
  readonly detail: string;
}

export function formatDuration(totalSeconds: number): string {
  if (totalSeconds > 0 && totalSeconds < SECONDS_PER_MINUTE) return '<1m';
  const { hours, minutes } = clockParts(totalSeconds);
  if (hours === 0) return `${String(minutes)}m`;
  return `${String(hours)}h ${String(minutes)}m`;
}

export function formatSessionCount(sessions: number): string {
  return `${String(sessions)} ${sessions === 1 ? 'session' : 'sessions'}`;
}

export function formatPracticeSummary({
  sessions,
  totalSeconds,
  avgBpm,
}: PracticeStats): PracticeSummary {
  if (sessions === 0) return { lead: null, detail: EMPTY_PRACTICE };
  const parts = [formatDuration(totalSeconds)];
  if (avgBpm !== null) parts.push(`avg ${String(Math.round(avgBpm))} BPM`);
  return {
    lead: formatSessionCount(sessions),
    detail: `${SEPARATOR} ${parts.join(` ${SEPARATOR} `)}`,
  };
}
