import type { PracticeStats } from '@kitbag/core-db';
import { countLabel } from '@kitbag/core-design';
import { clockParts, SECONDS_PER_MINUTE } from '@kitbag/core-state';

import { SEPARATOR } from './separator.ts';

const EMPTY_PRACTICE = 'No sessions yet';

export interface PracticeSummary {
  readonly lead: string | null;
  readonly detail: string;
}

export function formatDuration(totalSeconds: number): string {
  const wholeMinutes = Math.round(totalSeconds / SECONDS_PER_MINUTE);
  if (wholeMinutes === 0 && totalSeconds > 0) return 'under 1m';
  const { hours, minutes } = clockParts(wholeMinutes * SECONDS_PER_MINUTE);
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  return `${String(minutes)}m`;
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
    lead: countLabel(sessions, 'session', 'sessions'),
    detail: `${SEPARATOR} ${parts.join(` ${SEPARATOR} `)}`,
  };
}
