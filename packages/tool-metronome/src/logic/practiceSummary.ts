import { countLabel } from '@kitbag/core-design';
import type { PracticeStretch, PracticeSummary } from '@kitbag/core-state';

import { formatPracticeElapsed } from './practiceTimer.ts';

const SEPARATOR = ' · ';

export type SummarySheet = 'summary' | 'none';

export function summarySheetOnMount(
  pending: readonly PracticeSummary[],
): SummarySheet {
  return pending.length === 0 ? 'none' : 'summary';
}

export function practiceContextLine(summary: PracticeSummary): string | null {
  const parts: string[] = [];
  if (summary.setlist !== null) parts.push(summary.setlist.name);
  if (summary.songs.length > 0)
    parts.push(countLabel(summary.songs.length, 'song', 'songs'));
  return parts.length === 0 ? null : parts.join(SEPARATOR);
}

export function averageTempoLabel(avgBpm: number): string {
  return `${String(Math.round(avgBpm))} BPM`;
}

export function longestStretchLabel(
  stretch: PracticeStretch | null,
): string | null {
  if (stretch === null) return null;
  const time = formatPracticeElapsed(stretch.ms);
  return stretch.title === null ? time : `${stretch.title}${SEPARATOR}${time}`;
}
